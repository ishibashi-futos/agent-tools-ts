import type { TodoErrorCode } from "./types";

export class TodoError extends Error {
  readonly code: TodoErrorCode;

  constructor(code: TodoErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "TodoError";
  }
}

export const toInternalError = (error: unknown): TodoError => {
  if (error instanceof TodoError) {
    return error;
  }
  if (error instanceof Error) {
    return new TodoError("INTERNAL", error.message);
  }
  return new TodoError("INTERNAL", String(error));
};
