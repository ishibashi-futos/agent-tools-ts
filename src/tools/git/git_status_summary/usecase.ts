import type { ToolContext } from "../../../factory";
import { execCommand } from "../../exec/exec_command/tool";
import { GitStatusSummaryError } from "./error";
import { parseBranchFromPorcelain } from "./parse_branch";
import type { GitStatusSummaryOutput } from "./types";

const FIXED_TIMEOUT_MS = 30_000;
const REPOSITORY_ROOT_COMMAND = ["git", "rev-parse", "--show-toplevel"];
const STATUS_COMMAND = [
  "git",
  "-c",
  "core.quotePath=false",
  "status",
  "--porcelain=v1",
  "--branch",
];

const isNotGitRepositoryError = (exitCode: number, stderr: string): boolean => {
  return exitCode !== 0 && /not a git repository/i.test(stderr);
};

const buildFailureMessage = (prefix: string, stderr: string): string => {
  const trimmed = stderr.trim();
  return trimmed.length > 0 ? `${prefix}: ${trimmed}` : prefix;
};

type ExecCommandRunner = typeof execCommand;

type Dependencies = {
  execCommand: ExecCommandRunner;
};

export const createGitStatusSummaryUsecase = (
  deps: Dependencies = {
    execCommand,
  },
) => {
  return async (
    context: ToolContext,
    cwd: string,
  ): Promise<GitStatusSummaryOutput> => {
    const revParseResult = await deps.execCommand(
      context,
      cwd,
      REPOSITORY_ROOT_COMMAND,
      {
        shell_mode: "direct",
        timeout_ms: FIXED_TIMEOUT_MS,
      },
    );

    if (
      isNotGitRepositoryError(revParseResult.exit_code, revParseResult.stderr)
    ) {
      throw new GitStatusSummaryError(
        "NOT_GIT_REPOSITORY",
        `not a git repository: ${cwd}`,
      );
    }

    if (revParseResult.exit_code !== 0) {
      throw new GitStatusSummaryError(
        "INTERNAL",
        buildFailureMessage(
          "failed to resolve repository root",
          revParseResult.stderr,
        ),
      );
    }

    const statusResult = await deps.execCommand(context, cwd, STATUS_COMMAND, {
      shell_mode: "direct",
      timeout_ms: FIXED_TIMEOUT_MS,
    });

    if (isNotGitRepositoryError(statusResult.exit_code, statusResult.stderr)) {
      throw new GitStatusSummaryError(
        "NOT_GIT_REPOSITORY",
        `not a git repository: ${cwd}`,
      );
    }

    if (statusResult.exit_code !== 0) {
      throw new GitStatusSummaryError(
        "INTERNAL",
        buildFailureMessage("failed to get git status", statusResult.stderr),
      );
    }

    const raw = statusResult.stdout;
    return {
      repository_root: revParseResult.stdout.trim(),
      branch: parseBranchFromPorcelain(raw),
      raw,
    };
  };
};

export const gitStatusSummaryUsecase = createGitStatusSummaryUsecase();
