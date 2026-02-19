import type { ToolContext } from "../../../factory";
import {
  spawn,
  type SpawnOptions,
  type SpawnResult,
} from "../../../utils/exec";
import { toSha256Hex } from "../../../utils/hash";
import { toInternalError } from "./error";
import type { ApplyPatchUsecaseDependencies } from "./types";
import { applyPatchUsecase, createApplyPatchUsecase } from "./usecase";
import { validateApplyPatchInput } from "./validator";

type Dependencies =
  | {
      usecase: (input: { filePath: string; content: string }) => Promise<void>;
      spawn?: never;
      hasher?: never;
    }
  | {
      usecase?: undefined;
      spawn?: (cmd: string[], opts?: SpawnOptions) => Promise<SpawnResult>;
      hasher?: (input: string) => Promise<string>;
    };

export type ApplyPatchHandler = (
  context: ToolContext,
  filePath: string,
  content: string,
) => Promise<void>;

const toUsecase = (
  deps: Dependencies,
): ((input: { filePath: string; content: string }) => Promise<void>) => {
  if ("usecase" in deps && deps.usecase) {
    return deps.usecase;
  }

  const usecaseDeps: ApplyPatchUsecaseDependencies = {
    spawn: deps.spawn ?? spawn,
    hasher: deps.hasher ?? toSha256Hex,
  };

  return createApplyPatchUsecase(usecaseDeps);
};

export const createApplyPatch = (
  deps: Dependencies = {},
): ApplyPatchHandler => {
  const usecase = toUsecase(deps);

  return async (
    _context: ToolContext,
    filePath: string,
    content: string,
  ): Promise<void> => {
    try {
      const input = validateApplyPatchInput(filePath, content);
      await usecase(input);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const applyPatch = createApplyPatch({ usecase: applyPatchUsecase });
