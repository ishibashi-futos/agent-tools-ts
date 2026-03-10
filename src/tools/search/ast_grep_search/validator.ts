import { AstGrepSearchError } from "./error";
import type { AstGrepSearchInput, AstGrepSearchValidatedInput } from "./types";

const DEFAULT_ROOT_PATH = ".";
const DEFAULT_MAX_RESULTS = 100;
const MAX_MAX_RESULTS = 500;
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;

const hasBalancedToken = (
  pattern: string,
  openToken: string,
  closeToken: string,
): boolean => {
  let depth = 0;

  for (const char of pattern) {
    if (char === openToken) {
      depth += 1;
      continue;
    }

    if (char === closeToken) {
      if (depth === 0) {
        return false;
      }
      depth -= 1;
    }
  }

  return depth === 0;
};

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  if (normalized === ".") {
    return ".";
  }
  return normalized.replace(/\/+/g, "/").replace(/\/$/, "") || ".";
};

const validateStringArray = (
  value: unknown,
  key: "include" | "exclude",
): string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AstGrepSearchError(
      "INVALID_ARGUMENT",
      `${key} must be a string array`,
    );
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new AstGrepSearchError(
        "INVALID_ARGUMENT",
        `${key}[${index}] must be a string`,
      );
    }
    if (entry.length === 0) {
      throw new AstGrepSearchError(
        "INVALID_ARGUMENT",
        `${key} must not contain empty pattern`,
      );
    }
    if (entry.includes("\0")) {
      throw new AstGrepSearchError(
        "INVALID_ARGUMENT",
        `${key} pattern must not contain null char`,
      );
    }
    if (!hasBalancedToken(entry, "[", "]")) {
      throw new AstGrepSearchError(
        "INVALID_ARGUMENT",
        `${key} pattern has unbalanced square brackets`,
      );
    }
    if (!hasBalancedToken(entry, "{", "}")) {
      throw new AstGrepSearchError(
        "INVALID_ARGUMENT",
        `${key} pattern has unbalanced braces`,
      );
    }
    return entry.replace(/\\/g, "/");
  });
};

const validateIntegerRange = (
  value: unknown,
  key: string,
  min: number,
  max: number,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new AstGrepSearchError(
      "INVALID_ARGUMENT",
      `${key} must be an integer between ${min} and ${max}`,
    );
  }

  return value;
};

const ensureJsonSerializable = (value: unknown): void => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new AstGrepSearchError(
        "INVALID_ARGUMENT",
        "rule must be JSON serializable",
      );
    }
  } catch (error) {
    if (error instanceof AstGrepSearchError) {
      throw error;
    }
    throw new AstGrepSearchError(
      "INVALID_ARGUMENT",
      "rule must be JSON serializable",
    );
  }
};

export const validateAstGrepSearchInput = (
  input: AstGrepSearchInput,
): AstGrepSearchValidatedInput => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AstGrepSearchError("INVALID_ARGUMENT", "input must be an object");
  }

  if (
    typeof input.language !== "string" ||
    input.language.trim().length === 0
  ) {
    throw new AstGrepSearchError(
      "INVALID_ARGUMENT",
      "language must be a non-empty string",
    );
  }

  if (
    typeof input.rule !== "object" ||
    input.rule === null ||
    Array.isArray(input.rule)
  ) {
    throw new AstGrepSearchError("INVALID_ARGUMENT", "rule must be an object");
  }

  ensureJsonSerializable(input.rule);

  const rootPath =
    input.root_path === undefined ? DEFAULT_ROOT_PATH : input.root_path;
  if (typeof rootPath !== "string" || rootPath.trim().length === 0) {
    throw new AstGrepSearchError(
      "INVALID_ARGUMENT",
      "root_path must be a non-empty string",
    );
  }

  return {
    language: input.language.trim(),
    rule: input.rule,
    root_path: normalizePath(rootPath),
    include: validateStringArray(input.include, "include"),
    exclude: validateStringArray(input.exclude, "exclude"),
    max_results: validateIntegerRange(
      input.max_results ?? DEFAULT_MAX_RESULTS,
      "max_results",
      1,
      MAX_MAX_RESULTS,
    ),
    timeout_ms: validateIntegerRange(
      input.timeout_ms ?? DEFAULT_TIMEOUT_MS,
      "timeout_ms",
      1,
      MAX_TIMEOUT_MS,
    ),
  };
};
