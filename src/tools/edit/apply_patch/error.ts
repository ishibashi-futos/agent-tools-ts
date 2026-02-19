import type { ApplyPatchErrorCode } from "./types";

export class ApplyPatchError extends Error {
  readonly code: ApplyPatchErrorCode;

  constructor(code: ApplyPatchErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ApplyPatchError";
  }
}

export const toInternalError = (error: unknown): ApplyPatchError => {
  if (error instanceof ApplyPatchError) {
    return error;
  }
  if (error instanceof Error) {
    return new ApplyPatchError("INTERNAL", error.message);
  }
  return new ApplyPatchError("INTERNAL", String(error));
};
