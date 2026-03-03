import { mkdir, lstat } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { WriteFileError } from "./error";
import type { WriteFileInput, WriteFileOutput } from "./types";

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

const isExistingDirectory = async (path: string): Promise<boolean> => {
  try {
    const stats = await lstat(path);
    return stats.isDirectory();
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const isExistingFile = async (path: string): Promise<boolean> => {
  try {
    const stats = await lstat(path);
    return stats.isFile();
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

export const writeFileUsecase = async (
  workspaceRoot: string,
  input: WriteFileInput,
): Promise<WriteFileOutput> => {
  if (await isExistingDirectory(input.path)) {
    throw new WriteFileError("NOT_FILE", `path is a directory: ${input.path}`);
  }

  const existed = await isExistingFile(input.path);

  await mkdir(dirname(input.path), { recursive: true });
  const bytesWritten = await Bun.write(input.path, input.content);

  return {
    path: toWorkspaceRelativePath(workspaceRoot, input.path),
    created: !existed,
    bytes_written: bytesWritten,
  };
};
