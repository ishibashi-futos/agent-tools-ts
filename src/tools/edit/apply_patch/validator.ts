import { ApplyPatchError } from "./error";
import type { ApplyPatchInput } from "./types";

export const validateApplyPatchInput = (
  filePath: string,
  patch: string,
): ApplyPatchInput => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new ApplyPatchError(
      "INVALID_ARGUMENT",
      "filePath must be a non-empty string",
    );
  }

  if (typeof patch !== "string") {
    throw new ApplyPatchError("INVALID_ARGUMENT", "patch must be a string");
  }

  return {
    filePath,
    patch,
  };
};
