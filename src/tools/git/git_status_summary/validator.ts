import { GitStatusSummaryError } from "./error";
import type { GitStatusSummaryValidatedInput } from "./types";

const WINDOWS_DRIVE_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

export const validateGitStatusSummaryInput = (
  cwd?: string,
): GitStatusSummaryValidatedInput => {
  if (cwd === undefined) {
    return {};
  }

  if (typeof cwd !== "string" || cwd.trim().length === 0) {
    throw new GitStatusSummaryError(
      "INVALID_ARGUMENT",
      "cwd must be a non-empty string",
    );
  }

  if (WINDOWS_DRIVE_ABSOLUTE_PATH.test(cwd)) {
    throw new GitStatusSummaryError(
      "INVALID_ARGUMENT",
      "cwd must not be an absolute Windows drive path",
    );
  }

  return {
    cwd: cwd.replace(/\\/g, "/"),
  };
};
