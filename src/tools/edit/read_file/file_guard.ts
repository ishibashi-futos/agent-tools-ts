import { lstat, open } from "node:fs/promises";
import { ReadFileError } from "./error";

export const MAX_READ_FILE_SIZE_BYTES = 1024 * 1024;
const BINARY_CHECK_BYTES = 8192;

export type GuardedFileMeta = {
  byte_length: number;
  mtime_ms: number;
};

const ensureNotBinary = async (path: string): Promise<void> => {
  const handle = await open(path, "r");

  try {
    const buffer = Buffer.alloc(BINARY_CHECK_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, BINARY_CHECK_BYTES, 0);

    if (buffer.subarray(0, bytesRead).includes(0)) {
      throw new ReadFileError(
        "BINARY_NOT_SUPPORTED",
        `binary file is not supported: ${path}`,
      );
    }
  } finally {
    await handle.close();
  }
};

export const guardReadableTextFile = async (
  path: string,
): Promise<GuardedFileMeta> => {
  let fileStat;
  try {
    fileStat = await lstat(path);
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      throw new ReadFileError("NOT_FOUND", `path not found: ${path}`);
    }
    throw error;
  }

  if (!fileStat.isFile()) {
    throw new ReadFileError("NOT_FILE", `path is not a file: ${path}`);
  }

  if (fileStat.size > MAX_READ_FILE_SIZE_BYTES) {
    throw new ReadFileError(
      "SIZE_LIMIT_EXCEEDED",
      `file size exceeds 1 MiB limit: ${path}`,
    );
  }

  await ensureNotBinary(path);

  return {
    byte_length: fileStat.size,
    mtime_ms: fileStat.mtimeMs,
  };
};
