import { ExecCommandError } from "./error";
import type { ExecCommandInput, ExecCommandOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_CHARS = 200_000;
const MIN_TIMEOUT_MS = 1;
const MAX_TIMEOUT_MS = 120_000;
const MIN_MAX_OUTPUT_CHARS = 1_000;
const MAX_MAX_OUTPUT_CHARS = 1_000_000;

export const validateExecCommandInput = (
  cwd: string,
  command: string[],
  options: ExecCommandOptions = {},
): ExecCommandInput => {
  if (typeof cwd !== "string" || cwd.trim().length === 0) {
    throw new ExecCommandError(
      "INVALID_ARGUMENT",
      "cwd must be a non-empty string",
    );
  }

  if (!Array.isArray(command) || command.length === 0) {
    throw new ExecCommandError(
      "INVALID_ARGUMENT",
      "command must be a non-empty string array",
    );
  }

  for (const token of command) {
    if (typeof token !== "string") {
      throw new ExecCommandError(
        "INVALID_ARGUMENT",
        "command must contain only string elements",
      );
    }
    if (token.length === 0) {
      throw new ExecCommandError(
        "INVALID_ARGUMENT",
        "command elements must not be empty",
      );
    }
  }

  const shellMode = options.shell_mode ?? "default";
  if (shellMode !== "default" && shellMode !== "direct") {
    throw new ExecCommandError(
      "INVALID_ARGUMENT",
      'shell_mode must be "default" or "direct"',
    );
  }

  const timeoutMs = options.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  if (
    typeof timeoutMs !== "number" ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new ExecCommandError(
      "INVALID_ARGUMENT",
      `timeout_ms must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`,
    );
  }

  const maxOutputChars = options.max_output_chars ?? DEFAULT_MAX_OUTPUT_CHARS;
  if (
    typeof maxOutputChars !== "number" ||
    !Number.isFinite(maxOutputChars) ||
    maxOutputChars < MIN_MAX_OUTPUT_CHARS ||
    maxOutputChars > MAX_MAX_OUTPUT_CHARS
  ) {
    throw new ExecCommandError(
      "INVALID_ARGUMENT",
      `max_output_chars must be between ${MIN_MAX_OUTPUT_CHARS} and ${MAX_MAX_OUTPUT_CHARS}`,
    );
  }

  if (options.stdin !== undefined && typeof options.stdin !== "string") {
    throw new ExecCommandError("INVALID_ARGUMENT", "stdin must be a string");
  }

  return {
    cwd,
    command,
    shell_mode: shellMode,
    stdin: options.stdin,
    timeout_ms: timeoutMs,
    max_output_chars: maxOutputChars,
  };
};
