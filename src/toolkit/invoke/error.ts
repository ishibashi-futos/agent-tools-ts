import type { ToolErrorEnvelope } from "../../errors/envelope";

export type InvokeToolErrorCode =
  | "INVALID_TOOL_ARGUMENTS_TYPE"
  | "TOOL_NOT_FOUND"
  | "TOOL_NOT_ALLOWED"
  | "INTERNAL";

export class InvokeToolError extends Error {
  readonly code: InvokeToolErrorCode;
  readonly tool_name?: string;
  private readonly rawMessage: string;

  constructor(
    code: InvokeToolErrorCode,
    message: string,
    options: { tool_name?: string } = {},
  ) {
    super(`${code}: ${message}`);
    this.code = code;
    this.tool_name = options.tool_name;
    this.rawMessage = message;
    this.name = "InvokeToolError";
  }

  toEnvelope(): ToolErrorEnvelope {
    return {
      code: this.code,
      message: this.rawMessage,
      retriable: this.code === "INTERNAL",
      details: this.tool_name ? { tool_name: this.tool_name } : {},
    };
  }
}
