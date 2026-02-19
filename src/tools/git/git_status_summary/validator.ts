import { GitStatusSummaryError } from "./error";
import type { GitStatusSummaryValidatedInput } from "./types";

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

  return {
    cwd: cwd.replace(/\\/g, "/"),
  };
};
