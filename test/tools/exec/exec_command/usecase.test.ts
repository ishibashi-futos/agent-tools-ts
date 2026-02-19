import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execCommandUsecase } from "../../../../src/tools/exec/exec_command/usecase";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "exec-command-usecase-"));
};

describe("exec_command usecase", () => {
  it("timeout_ms 超過時に timed_out=true と exit_code=124 になること", async () => {
    const dir = await createTempDir();

    try {
      const result = await execCommandUsecase({
        cwd: dir,
        command: [process.execPath, "-e", "setTimeout(() => {}, 5000)"],
        shell_mode: "direct",
        timeout_ms: 50,
        max_output_chars: 200_000,
        platform: process.platform,
      });

      expect(result.timed_out).toBe(true);
      expect(result.exit_code).toBe(124);
      expect(result.duration_ms).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("max_output_chars を超える出力を打ち切ること", async () => {
    const dir = await createTempDir();

    try {
      const result = await execCommandUsecase({
        cwd: dir,
        command: [
          process.execPath,
          "-e",
          "console.log('x'.repeat(5000)); console.error('y'.repeat(5000));",
        ],
        shell_mode: "direct",
        timeout_ms: 30_000,
        max_output_chars: 1_000,
        platform: process.platform,
      });

      expect(result.exit_code).toBe(0);
      expect(result.stdout.length).toBe(1_000);
      expect(result.stderr.length).toBe(1_000);
      expect(result.stdout_truncated).toBe(true);
      expect(result.stderr_truncated).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("duration_ms が返ること", async () => {
    const dir = await createTempDir();

    try {
      const result = await execCommandUsecase({
        cwd: dir,
        command: [process.execPath, "-e", "console.log('ok')"],
        shell_mode: "direct",
        timeout_ms: 30_000,
        max_output_chars: 200_000,
        platform: process.platform,
      });

      expect(result.exit_code).toBe(0);
      expect(result.duration_ms).toBeGreaterThanOrEqual(1);
      expect(result.stdout.includes("ok")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
