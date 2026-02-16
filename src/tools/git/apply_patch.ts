import { spawn, type SpawnOptions, type SpawnResult } from "../../utils/exec";

type ApplyPatch = (filePath: string, content: string) => Promise<void>;
type Dependencies = {
  spawn: (cmd: string[], opts?: SpawnOptions) => Promise<SpawnResult>
}
const createApplyPatch = (deps: Dependencies = {
  spawn: spawn
}): ApplyPatch => {
  return async (filePath: string, content: string): Promise<void> => {
    const {
      exitCode,
      stderr
    } = await deps.spawn(["git", "apply", "--whitespace=fix", "--include", filePath, "-"], {
      stdin: Buffer.from(content)
    });

    if (exitCode !== 0) {
      throw new Error(`git apply failed with exit code ${exitCode}: ${stderr.trim() || 'unknown error'}`);
    }
  }
}

export const applyPatch = createApplyPatch();
