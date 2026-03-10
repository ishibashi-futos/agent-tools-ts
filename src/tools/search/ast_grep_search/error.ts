import type { AstGrepSearchErrorCode } from "./types";

export class AstGrepSearchError extends Error {
  readonly code: AstGrepSearchErrorCode;

  constructor(code: AstGrepSearchErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "AstGrepSearchError";
  }
}

export const toInternalError = (error: unknown): AstGrepSearchError => {
  if (error instanceof AstGrepSearchError) {
    return error;
  }
  if (error instanceof Error) {
    return new AstGrepSearchError("INTERNAL", error.message);
  }
  return new AstGrepSearchError("INTERNAL", String(error));
};
