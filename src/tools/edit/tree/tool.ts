import { lstat } from "node:fs/promises";
import type { ToolContext } from "../../../factory";
import type { TreeOptions, TreeOutput, TreeValidatedInput } from "./types";
import { treeUsecase } from "./usecase";

const DEFAULT_MAX_DEPTH = 3;
const MIN_MAX_DEPTH = 0;
const MAX_MAX_DEPTH = 12;

const DEFAULT_MAX_ENTRIES = 100;
const MIN_MAX_ENTRIES = 1;
const MAX_MAX_ENTRIES = 1000;

const DEFAULT_ENTRY_KIND = "directory";

type TreeErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "NOT_DIRECTORY"
  | "INTERNAL";

class TreeError extends Error {
  readonly code: TreeErrorCode;

  constructor(code: TreeErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "TreeError";
  }
}

const toTreeError = (error: unknown): TreeError => {
  if (error instanceof TreeError) {
    return error;
  }
  if (error instanceof Error) {
    return new TreeError("INTERNAL", error.message);
  }
  return new TreeError("INTERNAL", String(error));
};

const validateIntegerRange = (
  value: number,
  key: string,
  min: number,
  max: number,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new TreeError(
      "INVALID_ARGUMENT",
      `${key} must be an integer between ${min} and ${max}`,
    );
  }

  return value;
};

const validateExclude = (exclude: unknown): string[] => {
  if (exclude === undefined) {
    return [];
  }

  if (!Array.isArray(exclude)) {
    throw new TreeError("INVALID_ARGUMENT", "exclude must be a string array");
  }

  const result: string[] = [];

  for (const pattern of exclude) {
    if (typeof pattern !== "string") {
      throw new TreeError(
        "INVALID_ARGUMENT",
        "exclude must contain only strings",
      );
    }

    result.push(pattern);
  }

  return result;
};

const validateTreeInput = (
  path: string,
  options: TreeOptions = {},
): TreeValidatedInput => {
  if (typeof path !== "string" || path.trim().length === 0) {
    throw new TreeError("INVALID_ARGUMENT", "path must be a non-empty string");
  }

  const entryKind = options.entry_kind ?? DEFAULT_ENTRY_KIND;
  if (entryKind !== "directory" && entryKind !== "all") {
    throw new TreeError(
      "INVALID_ARGUMENT",
      'entry_kind must be "directory" or "all"',
    );
  }

  const maxDepth = validateIntegerRange(
    options.max_depth ?? DEFAULT_MAX_DEPTH,
    "max_depth",
    MIN_MAX_DEPTH,
    MAX_MAX_DEPTH,
  );

  const maxEntries = validateIntegerRange(
    options.max_entries ?? DEFAULT_MAX_ENTRIES,
    "max_entries",
    MIN_MAX_ENTRIES,
    MAX_MAX_ENTRIES,
  );

  const includeHidden = options.include_hidden ?? false;
  if (typeof includeHidden !== "boolean") {
    throw new TreeError("INVALID_ARGUMENT", "include_hidden must be a boolean");
  }

  return {
    path,
    entry_kind: entryKind,
    max_depth: maxDepth,
    max_entries: maxEntries,
    include_hidden: includeHidden,
    exclude: validateExclude(options.exclude),
  };
};

export type TreeHandler = (
  context: ToolContext,
  path: string,
  options?: TreeOptions,
) => Promise<TreeOutput>;

export const createTree = (
  deps: { usecase: typeof treeUsecase } = {
    usecase: treeUsecase,
  },
): TreeHandler => {
  return async (
    context: ToolContext,
    path: string,
    options: TreeOptions = {},
  ): Promise<TreeOutput> => {
    try {
      const input = validateTreeInput(path, options);

      let rootStat;
      try {
        rootStat = await lstat(input.path);
      } catch (error) {
        const e = error as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
          throw new TreeError("NOT_FOUND", `path not found: ${input.path}`);
        }
        throw error;
      }

      if (!rootStat.isDirectory()) {
        throw new TreeError(
          "NOT_DIRECTORY",
          `path is not a directory: ${input.path}`,
        );
      }

      return await deps.usecase(context.workspaceRoot, input);
    } catch (error) {
      throw toTreeError(error);
    }
  };
};

export const tree = createTree();
