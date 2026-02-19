import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { createTreeFilter } from "./filter";
import type {
  TreeDirectoryNode,
  TreeEntry,
  TreeOutput,
  TreeValidatedInput,
} from "./types";
import type { Dirent } from "node:fs";

type TreeState = {
  scannedEntries: number;
  limitReached: boolean;
  totalDirs: number;
  totalFiles: number;
  totalSymlinks: number;
};

type SortableEntry = {
  absolutePath: string;
  relativePath: string;
  name: string;
  kind: "directory" | "file" | "symlink";
};

type TraverseResult = {
  node: TreeDirectoryNode;
  state: TreeState;
};

type ProcessEntryResult = {
  node?: TreeEntry;
  state: TreeState;
};

type ConsumeResult = {
  children: TreeEntry[];
  state: TreeState;
};

const toWorkspaceRelativePath = (
  workspaceRoot: string,
  absolutePath: string,
): string => {
  const relativePath = relative(workspaceRoot, absolutePath).replace(
    /\\/g,
    "/",
  );
  return relativePath.length === 0 ? "." : relativePath;
};

const resolveEntryKind = (
  dirent: Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink">,
): SortableEntry["kind"] | null => {
  if (dirent.isDirectory()) {
    return "directory";
  }
  if (dirent.isFile()) {
    return "file";
  }
  if (dirent.isSymbolicLink()) {
    return "symlink";
  }
  return null;
};

const compareEntry = (a: SortableEntry, b: SortableEntry): number => {
  const kindWeight = (kind: SortableEntry["kind"]): number => {
    switch (kind) {
      case "directory":
        return 0;
      case "file":
        return 1;
      case "symlink":
        return 2;
    }
  };

  const kindDiff = kindWeight(a.kind) - kindWeight(b.kind);
  if (kindDiff !== 0) {
    return kindDiff;
  }

  if (a.name < b.name) {
    return -1;
  }
  if (a.name > b.name) {
    return 1;
  }
  return 0;
};

const incrementState = (
  state: TreeState,
  kind: SortableEntry["kind"],
  maxEntries: number,
): TreeState => {
  const nextScanned = state.scannedEntries + 1;

  const nextState = {
    scannedEntries: nextScanned,
    limitReached: state.limitReached || nextScanned >= maxEntries,
    totalDirs: state.totalDirs + (kind === "directory" ? 1 : 0),
    totalFiles: state.totalFiles + (kind === "file" ? 1 : 0),
    totalSymlinks: state.totalSymlinks + (kind === "symlink" ? 1 : 0),
  };

  return nextState;
};

const toSortedEntries = (
  workspaceRoot: string,
  currentAbsolutePath: string,
  dirents: readonly Dirent[],
  input: TreeValidatedInput,
  filter: ReturnType<typeof createTreeFilter>,
): SortableEntry[] => {
  return dirents
    .map((dirent): SortableEntry | null => {
      const absolutePath = join(currentAbsolutePath, dirent.name);
      const relativePath = toWorkspaceRelativePath(workspaceRoot, absolutePath);

      if (filter.shouldExclude(relativePath, dirent.name)) {
        return null;
      }

      const kind = resolveEntryKind(dirent);
      if (kind === null) {
        return null;
      }

      if (input.entry_kind === "directory" && kind !== "directory") {
        return null;
      }

      return {
        absolutePath,
        relativePath,
        name: dirent.name,
        kind,
      };
    })
    .filter((entry): entry is SortableEntry => entry !== null)
    .sort(compareEntry);
};

const createDirectoryNode = (
  entry: SortableEntry & { kind: "directory" },
  depth: number,
): TreeDirectoryNode => {
  return {
    kind: "directory",
    name: entry.name,
    path: entry.relativePath,
    depth,
  };
};

const createLeafNode = (
  entry: SortableEntry & { kind: "file" | "symlink" },
  depth: number,
): TreeEntry => {
  return {
    kind: entry.kind,
    name: entry.name,
    path: entry.relativePath,
    depth,
  };
};

const processEntry = async (
  workspaceRoot: string,
  input: TreeValidatedInput,
  filter: ReturnType<typeof createTreeFilter>,
  entry: SortableEntry,
  parentDepth: number,
  state: TreeState,
): Promise<ProcessEntryResult> => {
  if (state.limitReached || state.scannedEntries >= input.max_entries) {
    return {
      state: {
        ...state,
        limitReached: true,
      },
    };
  }

  const countedState = incrementState(state, entry.kind, input.max_entries);

  if (entry.kind !== "directory") {
    const leafEntry = entry as SortableEntry & { kind: "file" | "symlink" };
    return {
      node: createLeafNode(leafEntry, parentDepth + 1),
      state: countedState,
    };
  }

  const directoryEntry = entry as SortableEntry & { kind: "directory" };
  const baseNode = createDirectoryNode(directoryEntry, parentDepth + 1);

  if (countedState.limitReached) {
    return {
      node: baseNode,
      state: countedState,
    };
  }

  const traversed = await traverseDirectory(
    workspaceRoot,
    input,
    entry.absolutePath,
    baseNode,
    filter,
    countedState,
  );

  return {
    node: traversed.node,
    state: traversed.state,
  };
};

const consumeEntries = async (
  workspaceRoot: string,
  input: TreeValidatedInput,
  filter: ReturnType<typeof createTreeFilter>,
  iterator: Iterator<SortableEntry>,
  parentDepth: number,
  state: TreeState,
): Promise<ConsumeResult> => {
  if (state.limitReached) {
    return {
      children: [],
      state,
    };
  }

  const nextItem = iterator.next();
  if (nextItem.done) {
    return {
      children: [],
      state,
    };
  }

  const processed = await processEntry(
    workspaceRoot,
    input,
    filter,
    nextItem.value,
    parentDepth,
    state,
  );

  const rest = await consumeEntries(
    workspaceRoot,
    input,
    filter,
    iterator,
    parentDepth,
    processed.state,
  );

  return {
    children:
      processed.node === undefined
        ? rest.children
        : [processed.node, ...rest.children],
    state: rest.state,
  };
};

const traverseDirectory = async (
  workspaceRoot: string,
  input: TreeValidatedInput,
  currentAbsolutePath: string,
  currentNode: TreeDirectoryNode,
  filter: ReturnType<typeof createTreeFilter>,
  state: TreeState,
): Promise<TraverseResult> => {
  if (state.limitReached) {
    return { node: currentNode, state };
  }

  if (currentNode.depth >= input.max_depth) {
    return {
      node: {
        ...currentNode,
        truncated: true,
      },
      state,
    };
  }

  const dirents = await readdir(currentAbsolutePath, { withFileTypes: true });
  const sortedEntries = toSortedEntries(
    workspaceRoot,
    currentAbsolutePath,
    dirents,
    input,
    filter,
  );

  const consumed = await consumeEntries(
    workspaceRoot,
    input,
    filter,
    sortedEntries.values(),
    currentNode.depth,
    state,
  );

  return {
    node:
      consumed.children.length === 0
        ? currentNode
        : {
            ...currentNode,
            children: consumed.children,
          },
    state: consumed.state,
  };
};

export const treeUsecase = async (
  workspaceRoot: string,
  input: TreeValidatedInput,
): Promise<TreeOutput> => {
  const rootRelativePath = toWorkspaceRelativePath(workspaceRoot, input.path);
  const root: TreeDirectoryNode = {
    kind: "directory",
    name:
      rootRelativePath === "." ? "." : (input.path.split(/[\\/]/).pop() ?? "."),
    path: rootRelativePath,
    depth: 0,
  };

  const initialState: TreeState = {
    scannedEntries: 1,
    limitReached: input.max_entries <= 1,
    totalDirs: 1,
    totalFiles: 0,
    totalSymlinks: 0,
  };

  const filter = createTreeFilter(input.include_hidden, input.exclude);
  const traversed = initialState.limitReached
    ? { node: root, state: initialState }
    : await traverseDirectory(
        workspaceRoot,
        input,
        input.path,
        root,
        filter,
        initialState,
      );

  return {
    root: traversed.node,
    limit_reached: traversed.state.limitReached,
    scanned_entries: traversed.state.scannedEntries,
    total_dirs: traversed.state.totalDirs,
    total_files:
      input.entry_kind === "directory" ? 0 : traversed.state.totalFiles,
    total_symlinks:
      input.entry_kind === "directory" ? 0 : traversed.state.totalSymlinks,
  };
};
