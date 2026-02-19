import type { GitStatusSummaryErrorCode } from "./types";

export class GitStatusSummaryError extends Error {
  readonly code: GitStatusSummaryErrorCode;

  constructor(code: GitStatusSummaryErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "GitStatusSummaryError";
  }
}

export const toInternalError = (error: unknown): GitStatusSummaryError => {
  if (error instanceof GitStatusSummaryError) {
    return error;
  }
  if (error instanceof Error) {
    return new GitStatusSummaryError("INTERNAL", error.message);
  }
  return new GitStatusSummaryError("INTERNAL", String(error));
};
