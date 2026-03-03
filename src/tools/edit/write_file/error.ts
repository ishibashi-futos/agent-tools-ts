import type { WriteFileErrorCode } from "./types";

export class WriteFileError extends Error {
  readonly code: WriteFileErrorCode;

  constructor(code: WriteFileErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "WriteFileError";
  }
}

export const toInternalError = (error: unknown): WriteFileError => {
  if (error instanceof WriteFileError) {
    return error;
  }
  if (error instanceof Error) {
    return new WriteFileError("INTERNAL", error.message);
  }
  return new WriteFileError("INTERNAL", String(error));
};
