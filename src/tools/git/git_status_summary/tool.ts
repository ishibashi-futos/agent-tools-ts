import { stat } from "node:fs/promises";
import type { ToolContext } from "../../../factory";
import { SandboxPath } from "../../../sandbox/path";
import { GitStatusSummaryError, toInternalError } from "./error";
import type {
  GitStatusSummaryOutput,
  GitStatusSummaryValidatedInput,
} from "./types";
import { gitStatusSummaryUsecase } from "./usecase";
import { validateGitStatusSummaryInput } from "./validator";

type Dependencies = {
  usecase: typeof gitStatusSummaryUsecase;
};

const resolveTargetCwd = (
  context: ToolContext,
  input: GitStatusSummaryValidatedInput,
): string => {
  if (input.cwd === undefined) {
    return context.workspaceRoot;
  }

  return SandboxPath.resolveInWorkspace(input.cwd, context.workspaceRoot);
};

export type GitStatusSummaryHandler = (
  context: ToolContext,
  cwd?: string,
) => Promise<GitStatusSummaryOutput>;

export const createGitStatusSummary = (
  deps: Dependencies = {
    usecase: gitStatusSummaryUsecase,
  },
): GitStatusSummaryHandler => {
  return async (
    context: ToolContext,
    cwd?: string,
  ): Promise<GitStatusSummaryOutput> => {
    try {
      const validated = validateGitStatusSummaryInput(cwd);
      const targetCwd = resolveTargetCwd(context, validated);

      let cwdStat;
      try {
        cwdStat = await stat(targetCwd);
      } catch {
        throw new GitStatusSummaryError(
          "NOT_DIRECTORY",
          `cwd is not a directory: ${targetCwd}`,
        );
      }

      if (!cwdStat.isDirectory()) {
        throw new GitStatusSummaryError(
          "NOT_DIRECTORY",
          `cwd is not a directory: ${targetCwd}`,
        );
      }

      return await deps.usecase(context, targetCwd);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const gitStatusSummary = createGitStatusSummary();
