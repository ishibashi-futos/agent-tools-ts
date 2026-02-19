import { spawn } from "../../../utils/exec";
import { toSha256Hex } from "../../../utils/hash";
import { ApplyPatchError } from "./error";
import type { ApplyPatchInput, ApplyPatchUsecaseDependencies } from "./types";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ensureTargetFile = async (filePath: string): Promise<void> => {
  const inputFile = Bun.file(filePath);

  if (!(await inputFile.exists())) {
    throw new ApplyPatchError("NOT_FOUND", `file not found: ${filePath}`);
  }

  if (inputFile.size > MAX_FILE_SIZE_BYTES) {
    const currentSizeMB = (inputFile.size / (1024 * 1024)).toFixed(2);
    throw new ApplyPatchError(
      "FILE_TOO_LARGE",
      `file size exceeds the ${MAX_FILE_SIZE_MB} MB limit (actual: ${currentSizeMB})`,
    );
  }
};

export const createApplyPatchUsecase = (
  deps: ApplyPatchUsecaseDependencies = {
    spawn,
    hasher: toSha256Hex,
  },
) => {
  return async (input: ApplyPatchInput): Promise<void> => {
    await ensureTargetFile(input.filePath);

    const beforeHash = await deps.hasher(await Bun.file(input.filePath).text());

    const { exitCode, stderr } = await deps.spawn(
      ["git", "apply", "--whitespace=fix", "--include", input.filePath, "-"],
      {
        stdin: Buffer.from(input.content),
      },
    );

    const afterHash = await deps.hasher(await Bun.file(input.filePath).text());

    if (exitCode !== 0 && beforeHash === afterHash) {
      throw new ApplyPatchError(
        "APPLY_FAILED",
        `git apply failed with exit code ${exitCode}: ${stderr.trim() || "unknown error"}`,
      );
    }
  };
};

export const applyPatchUsecase = createApplyPatchUsecase();
