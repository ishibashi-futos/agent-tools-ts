import { readdir, readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import { RegexpSearchError } from "./error";
import { collectRegexpMatches } from "./matcher";
import { createRegexpSearchPathFilter } from "./path_filter";
import type {
  RegexpSearchItem,
  RegexpSearchOutput,
  RegexpSearchValidatedInput,
} from "./types";

type DirentLike = {
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
};

type FileStat = {
  isDirectory: () => boolean;
  isFile: () => boolean;
  size: number;
};

type UsecaseDependencies = {
  stat: (path: string) => Promise<FileStat>;
  readdir: (path: string) => Promise<DirentLike[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  now: () => number;
};

const decoder = new TextDecoder("utf-8", { fatal: true });

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

const normalizeRelativePath = (
  rootRelativePath: string,
  childName?: string,
): string => {
  const base = rootRelativePath === "." ? "" : rootRelativePath;
  const joined = childName === undefined ? base : `${base}/${childName}`;
  return joined.replace(/^\/+/, "");
};

const isBinaryContent = (content: Uint8Array): boolean => {
  return content.includes(0);
};

const toWarningEntries = (
  binaryCount: number,
  sizeLimitCount: number,
): string[] => {
  const warnings: string[] = [];
  if (binaryCount > 0) {
    warnings.push(`skipped_binary_files=${binaryCount}`);
  }
  if (sizeLimitCount > 0) {
    warnings.push(`skipped_size_limit_files=${sizeLimitCount}`);
  }
  return warnings;
};

export const createRegexpSearchUsecase = (
  deps: UsecaseDependencies = {
    stat: async (path) => await stat(path),
    readdir: async (path) => await readdir(path, { withFileTypes: true }),
    readFile: async (path) => new Uint8Array(await readFile(path)),
    now: () => Date.now(),
  },
) => {
  return async (
    workspaceRoot: string,
    input: RegexpSearchValidatedInput,
  ): Promise<RegexpSearchOutput> => {
    const startedAt = deps.now();
    const deadline = startedAt + input.timeout_ms;
    const filter = createRegexpSearchPathFilter(input.include, input.exclude);

    const rootStat = await deps.stat(input.root_path);
    if (!rootStat.isDirectory()) {
      throw new RegexpSearchError(
        "NOT_DIRECTORY",
        `root_path is not a directory: ${input.root_path}`,
      );
    }

    const items: RegexpSearchItem[] = [];
    let scannedFiles = 0;
    let skippedBinaryFiles = 0;
    let skippedSizeLimitFiles = 0;
    let truncated = false;

    const ensureNotTimedOut = (): void => {
      if (deps.now() > deadline) {
        throw new RegexpSearchError("TIMEOUT", "search timed out");
      }
    };

    const walk = async (
      absoluteDirectoryPath: string,
      rootRelativePath: string,
    ): Promise<void> => {
      ensureNotTimedOut();

      const entries = await deps.readdir(absoluteDirectoryPath);
      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        ensureNotTimedOut();
        if (truncated) {
          return;
        }

        const absoluteEntryPath = `${absoluteDirectoryPath}/${entry.name}`;
        const relativePath = normalizeRelativePath(
          rootRelativePath,
          entry.name,
        );

        if (entry.isSymbolicLink()) {
          continue;
        }
        if (entry.isDirectory()) {
          if (!filter.shouldTraverseDirectory(relativePath, entry.name)) {
            continue;
          }
          await walk(absoluteEntryPath, relativePath);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        if (!filter.shouldIncludeFile(relativePath)) {
          continue;
        }

        const fileStat = await deps.stat(absoluteEntryPath);
        if (fileStat.size > input.max_file_size_bytes) {
          skippedSizeLimitFiles += 1;
          continue;
        }

        const rawContent = await deps.readFile(absoluteEntryPath);
        if (isBinaryContent(rawContent)) {
          skippedBinaryFiles += 1;
          continue;
        }

        let textContent: string;
        try {
          textContent = decoder.decode(rawContent);
        } catch {
          skippedBinaryFiles += 1;
          continue;
        }

        scannedFiles += 1;
        const fileItems = collectRegexpMatches(
          toWorkspaceRelativePath(workspaceRoot, absoluteEntryPath),
          input.pattern,
          input.flags,
          textContent,
        );

        for (const item of fileItems) {
          items.push(item);
          if (items.length >= input.max_results) {
            truncated = true;
            return;
          }
        }
      }
    };

    await walk(input.root_path, ".");
    ensureNotTimedOut();

    items.sort((left, right) => {
      if (left.path !== right.path) {
        return left.path.localeCompare(right.path);
      }
      if (left.line !== right.line) {
        return left.line - right.line;
      }
      return left.column - right.column;
    });

    return {
      query: {
        pattern: input.pattern,
        flags: input.flags,
      },
      root_path: toWorkspaceRelativePath(workspaceRoot, input.root_path),
      took_ms: Math.max(0, deps.now() - startedAt),
      truncated,
      scanned_files: scannedFiles,
      items,
      warnings: toWarningEntries(skippedBinaryFiles, skippedSizeLimitFiles),
    };
  };
};

export const regexpSearchUsecase = createRegexpSearchUsecase();
