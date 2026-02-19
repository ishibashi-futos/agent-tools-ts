export type GitStatusSummaryInput = {
  cwd?: string;
};

export type GitStatusSummaryOutput = {
  repository_root: string;
  branch: string | null;
  raw: string;
};

export type GitStatusSummaryErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_DIRECTORY"
  | "NOT_GIT_REPOSITORY"
  | "INTERNAL";

export type GitStatusSummaryValidatedInput = {
  cwd?: string;
};
