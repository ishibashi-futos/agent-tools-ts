import { stat } from "node:fs/promises";
import type { ToolContext } from "../../../factory";
import { AstGrepSearchError, toInternalError } from "./error";
import type { AstGrepSearchInput, AstGrepSearchOutput } from "./types";
import { astGrepSearchUsecase } from "./usecase";
import { validateAstGrepSearchInput } from "./validator";

type Dependencies = {
  usecase: typeof astGrepSearchUsecase;
};

export type AstGrepSearchHandler = (
  context: ToolContext,
  input: AstGrepSearchInput,
) => Promise<AstGrepSearchOutput>;

export const createAstGrepSearch = (
  deps: Dependencies = {
    usecase: astGrepSearchUsecase,
  },
): AstGrepSearchHandler => {
  return async (
    context: ToolContext,
    input: AstGrepSearchInput,
  ): Promise<AstGrepSearchOutput> => {
    try {
      const validated = validateAstGrepSearchInput({
        ...input,
        root_path: input.root_path ?? context.workspaceRoot,
      });

      let rootStat: Awaited<ReturnType<typeof stat>>;
      try {
        rootStat = await stat(validated.root_path);
      } catch {
        throw new AstGrepSearchError(
          "NOT_FOUND",
          `root_path does not exist: ${validated.root_path}`,
        );
      }

      if (!rootStat.isDirectory()) {
        throw new AstGrepSearchError(
          "NOT_DIRECTORY",
          `root_path is not a directory: ${validated.root_path}`,
        );
      }

      return await deps.usecase(context.workspaceRoot, validated);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const astGrepSearch = createAstGrepSearch();
