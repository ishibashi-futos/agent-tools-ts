import { WriteFileError } from "./error";
import type { WriteFileInput } from "./types";

export const validateWriteFileInput = (
  path: string,
  content: string,
): WriteFileInput => {
  if (typeof path !== "string" || path.trim().length === 0) {
    throw new WriteFileError(
      "INVALID_ARGUMENT",
      "path must be a non-empty string",
    );
  }

  if (typeof content !== "string") {
    throw new WriteFileError("INVALID_ARGUMENT", "content must be a string");
  }

  return {
    path,
    content,
  };
};
