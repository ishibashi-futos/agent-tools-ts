import { spawn, type SpawnOptions, type SpawnResult } from "../../utils/exec";
import { type ToolContext } from "../../factory";
import { toSha256Hex } from "../../utils/hash";

type ApplyPatch = (
  context: ToolContext,
  filePath: string,
  content: string,
) => Promise<void>;
type Dependencies = {
  spawn: (cmd: string[], opts?: SpawnOptions) => Promise<SpawnResult>;
  hasher: (input: string) => Promise<string>;
};

// TODO: ファイルサイズをContextで注入できるようにしておく
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const createApplyPatch = (
  deps: Dependencies = {
    spawn: spawn,
    hasher: toSha256Hex,
  },
): ApplyPatch => {
  return async (
    _context: ToolContext,
    filePath: string,
    content: string,
  ): Promise<void> => {
    // Windowsでは、git applyのコマンドが適用されてもエラーになる場合があるため、確実にハッシュをチェックする
    const inputFile = Bun.file(filePath);
    if (!(await inputFile.exists())) {
      throw new Error(`file not found: ${filePath}`);
    }
    if (inputFile.size > MAX_FILE_SIZE_BYTES) {
      const currentSizeMB = (inputFile.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `file size exceeds the ${MAX_FILE_SIZE_MB} MB limit (actual: ${currentSizeMB})`,
      );
    }

    const beforeHash = await deps.hasher(await inputFile.text());
    const { exitCode, stderr } = await deps.spawn(
      ["git", "apply", "--whitespace=fix", "--include", filePath, "-"],
      {
        stdin: Buffer.from(content),
      },
    );

    const afterHash = await deps.hasher(await Bun.file(filePath).text());
    if (exitCode !== 0 && beforeHash === afterHash) {
      throw new Error(
        `git apply failed with exit code ${exitCode}: ${stderr.trim() || "unknown error"}`,
      );
    }
  };
};

export const applyPatch = createApplyPatch();
