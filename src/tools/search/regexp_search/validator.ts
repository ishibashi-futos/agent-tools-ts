import { RegexpSearchError } from "./error";
import type { RegexpSearchInput, RegexpSearchValidatedInput } from "./types";

const DEFAULT_FLAGS = "";
const DEFAULT_ROOT_PATH = ".";
const DEFAULT_MAX_RESULTS = 100;
const MAX_MAX_RESULTS = 500;
const FIXED_MAX_FILE_SIZE_BYTES = 1_048_576 as const;
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const ALLOWED_FLAGS = new Set(["g", "i", "m", "s", "u"]);

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
    throw new RegexpSearchError(
      "INVALID_ARGUMENT",
      `${key} must be a string array`,
    );
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new RegexpSearchError(
        "INVALID_ARGUMENT",
        `${key}[${index}] must be a string`,
      );
    }
    if (entry.length === 0) {
      throw new RegexpSearchError(
        "INVALID_ARGUMENT",
        `${key} must not contain empty pattern`,
      );
    }
    if (entry.includes("\0")) {
      throw new RegexpSearchError(
        "INVALID_ARGUMENT",
        `${key} pattern must not contain null char`,
      );
    }
    if (!hasBalancedToken(entry, "[", "]")) {
      throw new RegexpSearchError(
        "INVALID_ARGUMENT",
        `${key} pattern has unbalanced square brackets`,
      );
    }
    if (!hasBalancedToken(entry, "{", "}")) {
      throw new RegexpSearchError(
        "INVALID_ARGUMENT",
        `${key} pattern has unbalanced braces`,
      );
    }
    return entry;
  });
};

const validateFlags = (flags: unknown): string => {
  if (flags === undefined) {
    return DEFAULT_FLAGS;
  }
  if (typeof flags !== "string") {
    throw new RegexpSearchError("INVALID_ARGUMENT", "flags must be a string");
  }

  const seen = new Set<string>();
  for (const flag of flags) {
    if (!ALLOWED_FLAGS.has(flag)) {
      throw new RegexpSearchError(
        "INVALID_ARGUMENT",
        "flags must contain only g, i, m, s, u",
      );
    }
    if (seen.has(flag)) {
      throw new RegexpSearchError(
        "INVALID_ARGUMENT",
        `flags must not contain duplicate flag: ${flag}`,
      );
    }
    seen.add(flag);
  }

  return flags;
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
    throw new RegexpSearchError(
      "INVALID_ARGUMENT",
      `${key} must be an integer between ${min} and ${max}`,
    );
  }

  return value;
};

export const validateRegexpSearchInput = (
  input: RegexpSearchInput,
): RegexpSearchValidatedInput => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RegexpSearchError("INVALID_ARGUMENT", "input must be an object");
  }

  if (typeof input.pattern !== "string" || input.pattern.length === 0) {
    throw new RegexpSearchError(
      "INVALID_ARGUMENT",
      "pattern must be a non-empty string",
    );
  }

  const flags = validateFlags(input.flags);
  try {
    void new RegExp(input.pattern, flags);
  } catch (error) {
    if (error instanceof Error) {
      throw new RegexpSearchError("INVALID_REGEX", error.message);
    }
    throw new RegexpSearchError("INVALID_REGEX", String(error));
  }

  const rootPath =
    input.root_path === undefined ? DEFAULT_ROOT_PATH : input.root_path;
  if (typeof rootPath !== "string" || rootPath.trim().length === 0) {
    throw new RegexpSearchError(
      "INVALID_ARGUMENT",
      "root_path must be a non-empty string",
    );
  }

  const maxResults = validateIntegerRange(
    input.max_results ?? DEFAULT_MAX_RESULTS,
    "max_results",
    1,
    MAX_MAX_RESULTS,
  );
  const timeoutMs = validateIntegerRange(
    input.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    "timeout_ms",
    1,
    MAX_TIMEOUT_MS,
  );

  const maxFileSizeBytes =
    input.max_file_size_bytes ?? FIXED_MAX_FILE_SIZE_BYTES;
  if (maxFileSizeBytes !== FIXED_MAX_FILE_SIZE_BYTES) {
    throw new RegexpSearchError(
      "INVALID_ARGUMENT",
      `max_file_size_bytes must be ${FIXED_MAX_FILE_SIZE_BYTES}`,
    );
  }

  return {
    pattern: input.pattern,
    flags,
    root_path: normalizePath(rootPath),
    include: validateStringArray(input.include, "include"),
    exclude: validateStringArray(input.exclude, "exclude"),
    max_results: maxResults,
    max_file_size_bytes: FIXED_MAX_FILE_SIZE_BYTES,
    timeout_ms: timeoutMs,
  };
};
