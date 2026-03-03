import type { ToolContext } from "../../../factory";
import {
  spawn,
  type SpawnOptions,
  type SpawnResult,
} from "../../../utils/exec";
import { toSha256Hex } from "../../../utils/hash";
import { toInternalError } from "./error";
import type { ApplyPatchOutput, ApplyPatchUsecaseDependencies } from "./types";
import { applyPatchUsecase, createApplyPatchUsecase } from "./usecase";
import { validateApplyPatchInput } from "./validator";

type Dependencies =
  | {
      usecase: (input: {
        filePath: string;
        patch: string;
      }) => Promise<ApplyPatchOutput>;
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
  patch: string,
) => Promise<ApplyPatchOutput>;

const toUsecase = (
  deps: Dependencies,
): ((input: {
  filePath: string;
  patch: string;
}) => Promise<ApplyPatchOutput>) => {
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
    patch: string,
  ): Promise<ApplyPatchOutput> => {
    try {
      const input = validateApplyPatchInput(filePath, patch);
      return await usecase(input);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const applyPatch = createApplyPatch({ usecase: applyPatchUsecase });
