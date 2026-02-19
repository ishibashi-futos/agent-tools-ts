import type { SpawnOptions, SpawnResult } from "../../../utils/exec";

export type ApplyPatchErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "FILE_TOO_LARGE"
  | "APPLY_FAILED"
  | "INTERNAL";

export type ApplyPatchInput = {
  filePath: string;
  content: string;
};

export type ApplyPatchUsecaseDependencies = {
  spawn: (cmd: string[], opts?: SpawnOptions) => Promise<SpawnResult>;
  hasher: (input: string) => Promise<string>;
};
