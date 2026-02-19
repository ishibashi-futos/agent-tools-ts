import type { ToolContext } from "../../../factory";
import { toInternalError } from "./error";
import type { ReadFileOptions, ReadFileOutput } from "./types";
import { readFileUsecase } from "./usecase";
import { validateReadFileInput } from "./validator";

type Dependencies = {
  usecase: typeof readFileUsecase;
};

export type ReadFileHandler = (
  context: ToolContext,
  path: string,
  options?: ReadFileOptions,
) => Promise<ReadFileOutput>;

export const createReadFile = (
  deps: Dependencies = {
    usecase: readFileUsecase,
  },
): ReadFileHandler => {
  return async (
    context: ToolContext,
    path: string,
    options: ReadFileOptions = {},
  ): Promise<ReadFileOutput> => {
    try {
      const input = validateReadFileInput(path, options);
      return await deps.usecase(context.workspaceRoot, input);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const readFile = createReadFile();
