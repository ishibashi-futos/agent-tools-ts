import { ReadFileError } from "./error";
import type { ReadFileOptions, ReadFileValidatedInput } from "./types";

const DEFAULT_START_LINE = 1;
const DEFAULT_MAX_LINES = 200;
const MIN_LINE_VALUE = 1;
const MAX_MAX_LINES = 500;

const validateIntegerRange = (
  value: unknown,
  key: string,
  min: number,
  max?: number,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < min ||
    (max !== undefined && value > max)
  ) {
    const rangeMessage =
      max === undefined ? `>= ${min}` : `between ${min} and ${max}`;
    throw new ReadFileError(
      "INVALID_ARGUMENT",
      `${key} must be an integer ${rangeMessage}`,
    );
  }

  return value;
};

export const validateReadFileInput = (
  path: string,
  options: ReadFileOptions = {},
): ReadFileValidatedInput => {
  if (typeof path !== "string" || path.trim().length === 0) {
    throw new ReadFileError(
      "INVALID_ARGUMENT",
      "path must be a non-empty string",
    );
  }

  const startLine = validateIntegerRange(
    options.start_line ?? DEFAULT_START_LINE,
    "start_line",
    MIN_LINE_VALUE,
  );

  const maxLines = validateIntegerRange(
    options.max_lines ?? DEFAULT_MAX_LINES,
    "max_lines",
    MIN_LINE_VALUE,
    MAX_MAX_LINES,
  );

  return {
    path,
    start_line: startLine,
    max_lines: maxLines,
  };
};
