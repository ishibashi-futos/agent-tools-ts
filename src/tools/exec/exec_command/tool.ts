import { stat } from "node:fs/promises";
import type { ToolContext } from "../../../factory";
import { ExecCommandError, toInternalError } from "./error";
import type { ExecCommandInput, ExecCommandOutput } from "./types";
import { execCommandUsecase } from "./usecase";
import { validateExecCommandInput } from "./validator";

type Dependencies = {
  usecase: typeof execCommandUsecase;
};

export type ExecCommandHandler = (
  context: ToolContext,
  input: ExecCommandInput,
) => Promise<ExecCommandOutput>;

export const createExecCommand = (
  deps: Dependencies = {
    usecase: execCommandUsecase,
  },
): ExecCommandHandler => {
  return async (
    context: ToolContext,
    input: ExecCommandInput,
  ): Promise<ExecCommandOutput> => {
    try {
      const validated = validateExecCommandInput(input);

      let cwdStat;
      try {
        cwdStat = await stat(validated.cwd);
      } catch {
        throw new ExecCommandError(
          "NOT_DIRECTORY",
          `cwd is not a directory: ${validated.cwd}`,
        );
      }

      if (!cwdStat.isDirectory()) {
        throw new ExecCommandError(
          "NOT_DIRECTORY",
          `cwd is not a directory: ${validated.cwd}`,
        );
      }

      return await deps.usecase({
        ...validated,
        platform: context.env.platform,
      });
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const execCommand = createExecCommand();
