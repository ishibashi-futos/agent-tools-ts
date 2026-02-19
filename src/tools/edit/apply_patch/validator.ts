import { ApplyPatchError } from "./error";
import type { ApplyPatchInput } from "./types";

export const validateApplyPatchInput = (
  filePath: string,
  content: string,
): ApplyPatchInput => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new ApplyPatchError(
      "INVALID_ARGUMENT",
      "filePath must be a non-empty string",
    );
  }

  if (typeof content !== "string") {
    throw new ApplyPatchError("INVALID_ARGUMENT", "content must be a string");
  }

  return {
    filePath,
    content,
  };
};
