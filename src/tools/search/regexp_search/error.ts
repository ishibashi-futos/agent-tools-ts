import type { RegexpSearchErrorCode } from "./types";

export class RegexpSearchError extends Error {
  readonly code: RegexpSearchErrorCode;

  constructor(code: RegexpSearchErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "RegexpSearchError";
  }
}

export const toInternalError = (error: unknown): RegexpSearchError => {
  if (error instanceof RegexpSearchError) {
    return error;
  }
  if (error instanceof Error) {
    return new RegexpSearchError("INTERNAL", error.message);
  }
  return new RegexpSearchError("INTERNAL", String(error));
};
