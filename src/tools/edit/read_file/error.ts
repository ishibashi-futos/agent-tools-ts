import type { ReadFileErrorCode } from "./types";

export class ReadFileError extends Error {
  readonly code: ReadFileErrorCode;

  constructor(code: ReadFileErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "ReadFileError";
  }
}

export const toInternalError = (error: unknown): ReadFileError => {
  if (error instanceof ReadFileError) {
    return error;
  }
  if (error instanceof Error) {
    return new ReadFileError("INTERNAL", error.message);
  }
  return new ReadFileError("INTERNAL", String(error));
};
