import { relative } from "node:path";
import { guardReadableTextFile, type GuardedFileMeta } from "./file_guard";
import type { ReadFileOutput, ReadFileValidatedInput } from "./types";

type ReadFileUsecaseDependencies = {
  guard: (path: string) => Promise<GuardedFileMeta>;
  readText: (path: string) => Promise<string>;
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

const toLines = (content: string): string[] => {
  const normalized = content.replace(/\r\n/g, "\n");
  if (normalized.length === 0) {
    return [];
  }
  return normalized.split("\n");
};

export const createReadFileUsecase = (
  deps: ReadFileUsecaseDependencies = {
    guard: guardReadableTextFile,
    readText: async (path: string): Promise<string> => Bun.file(path).text(),
  },
) => {
  return async (
    workspaceRoot: string,
    input: ReadFileValidatedInput,
  ): Promise<ReadFileOutput> => {
    const guarded = await deps.guard(input.path);
    const fileText = await deps.readText(input.path);
    const lines = toLines(fileText);

    const startIndex = input.start_line - 1;
    if (startIndex >= lines.length) {
      return {
        path: toWorkspaceRelativePath(workspaceRoot, input.path),
        content: "",
        truncated: false,
        next_start_line: null,
        meta: {
          byte_length: guarded.byte_length,
          line_count: lines.length,
          returned_line_count: 0,
          mtime_ms: guarded.mtime_ms,
        },
      };
    }

    const endIndex = Math.min(lines.length, startIndex + input.max_lines);
    const returnedLines = lines.slice(startIndex, endIndex);
    const truncated = endIndex < lines.length;

    return {
      path: toWorkspaceRelativePath(workspaceRoot, input.path),
      content: returnedLines.join("\n"),
      truncated,
      next_start_line: truncated ? endIndex + 1 : null,
      meta: {
        byte_length: guarded.byte_length,
        line_count: lines.length,
        returned_line_count: returnedLines.length,
        mtime_ms: guarded.mtime_ms,
      },
    };
  };
};

export const readFileUsecase = createReadFileUsecase();
