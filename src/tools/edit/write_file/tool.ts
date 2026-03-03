import type { ToolContext } from "../../../factory";
import { toInternalError } from "./error";
import type { WriteFileOutput } from "./types";
import { writeFileUsecase } from "./usecase";
import { validateWriteFileInput } from "./validator";

type Dependencies = {
  usecase: typeof writeFileUsecase;
};

export type WriteFileHandler = (
  context: ToolContext,
  path: string,
  content: string,
) => Promise<WriteFileOutput>;

export const createWriteFile = (
  deps: Dependencies = {
    usecase: writeFileUsecase,
  },
): WriteFileHandler => {
  return async (
    context: ToolContext,
    path: string,
    content: string,
  ): Promise<WriteFileOutput> => {
    try {
      const input = validateWriteFileInput(path, content);
      return await deps.usecase(context.workspaceRoot, input);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const writeFile = createWriteFile();
