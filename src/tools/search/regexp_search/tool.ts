import { stat } from "node:fs/promises";
import type { ToolContext } from "../../../factory";
import { RegexpSearchError, toInternalError } from "./error";
import type { RegexpSearchInput, RegexpSearchOutput } from "./types";
import { regexpSearchUsecase } from "./usecase";
import { validateRegexpSearchInput } from "./validator";

type Dependencies = {
  usecase: typeof regexpSearchUsecase;
};

export type RegexpSearchHandler = (
  context: ToolContext,
  input: RegexpSearchInput,
) => Promise<RegexpSearchOutput>;

export const createRegexpSearch = (
  deps: Dependencies = {
    usecase: regexpSearchUsecase,
  },
): RegexpSearchHandler => {
  return async (
    context: ToolContext,
    input: RegexpSearchInput,
  ): Promise<RegexpSearchOutput> => {
    try {
      const validated = validateRegexpSearchInput({
        ...input,
        root_path: input.root_path ?? context.workspaceRoot,
      });

      let rootStat: Awaited<ReturnType<typeof stat>>;
      try {
        rootStat = await stat(validated.root_path);
      } catch {
        throw new RegexpSearchError(
          "NOT_FOUND",
          `root_path does not exist: ${validated.root_path}`,
        );
      }

      if (!rootStat.isDirectory()) {
        throw new RegexpSearchError(
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

export const regexpSearch = createRegexpSearch();
