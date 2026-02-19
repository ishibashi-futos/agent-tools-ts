import type { ExecCommandErrorCode } from "./types";

export class ExecCommandError extends Error {
  readonly code: ExecCommandErrorCode;

  constructor(code: ExecCommandErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "ExecCommandError";
  }
}

export const toInternalError = (error: unknown): ExecCommandError => {
  if (error instanceof ExecCommandError) {
    return error;
  }
  if (error instanceof Error) {
    return new ExecCommandError("INTERNAL", error.message);
  }
  return new ExecCommandError("INTERNAL", String(error));
};
