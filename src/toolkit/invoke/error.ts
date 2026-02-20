export type InvokeToolErrorCode =
  | "INVALID_TOOL_ARGUMENTS_TYPE"
  | "TOOL_NOT_FOUND"
  | "TOOL_NOT_ALLOWED"
  | "INTERNAL";

export class InvokeToolError extends Error {
  readonly code: InvokeToolErrorCode;
  readonly tool_name?: string;

  constructor(
    code: InvokeToolErrorCode,
    message: string,
    options: { tool_name?: string } = {},
  ) {
    super(`${code}: ${message}`);
    this.code = code;
    this.tool_name = options.tool_name;
    this.name = "InvokeToolError";
  }
}
