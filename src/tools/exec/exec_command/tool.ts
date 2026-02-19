import { stat } from "node:fs/promises";
import type { ToolContext } from "../../../factory";
import { ExecCommandError, toInternalError } from "./error";
import type { ExecCommandOptions, ExecCommandOutput } from "./types";
import { execCommandUsecase } from "./usecase";
import { validateExecCommandInput } from "./validator";

type Dependencies = {
  usecase: typeof execCommandUsecase;
};

export type ExecCommandHandler = (
  context: ToolContext,
  cwd: string,
  command: string[],
  options?: ExecCommandOptions,
) => Promise<ExecCommandOutput>;

export const createExecCommand = (
  deps: Dependencies = {
    usecase: execCommandUsecase,
  },
): ExecCommandHandler => {
  return async (
    context: ToolContext,
    cwd: string,
    command: string[],
    options: ExecCommandOptions = {},
  ): Promise<ExecCommandOutput> => {
    try {
      const input = validateExecCommandInput(cwd, command, options);

      let cwdStat;
      try {
        cwdStat = await stat(input.cwd);
      } catch {
        throw new ExecCommandError(
          "NOT_DIRECTORY",
          `cwd is not a directory: ${input.cwd}`,
        );
      }

      if (!cwdStat.isDirectory()) {
        throw new ExecCommandError(
          "NOT_DIRECTORY",
          `cwd is not a directory: ${input.cwd}`,
        );
      }

      return await deps.usecase({
        ...input,
        platform: context.env.platform,
      });
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const execCommand = createExecCommand();
