import { afterEach, describe, expect, it, vi } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApplyPatch } from "../../../../src/tools/edit/apply_patch/tool.ts";
import type { ToolContext } from "../../../../src/factory";
import type { SpawnResult } from "../../../../src/utils/exec.ts";

const context: ToolContext = {
  workspaceRoot: ".",
  writeScope: "workspace-write",
  policy: { tools: {}, defaultPolicy: "allow" },
  env: { platform: "linux", osRelease: "test" },
};

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "apply-patch-test-"));
};

const escapeRegExp = (input: string): string => {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const toSpawnResult = (
  partial: Pick<SpawnResult, "exitCode" | "stdout" | "stderr">,
): SpawnResult => {
  return {
    ...partial,
    timedOut: false,
    stdoutTruncated: false,
    stderrTruncated: false,
    durationMs: 1,
  };
};

const expectRejectMessage = async (
  promise: Promise<unknown>,
  pattern: RegExp,
): Promise<void> => {
  try {
    await promise;
    throw new Error("Expected promise to reject");
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    expect(error.message).toMatch(pattern);
  }
};

describe("createApplyPatch", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it("存在しないファイルを指定した場合はエラーになること", async () => {
    const spawn = vi.fn();
    const applyPatch = createApplyPatch({
      spawn,
      hasher: async (input) => input,
    });

    await expectRejectMessage(
      applyPatch(context, "/tmp/not-found-file.txt", "patch content"),
      /^file not found: \/tmp\/not-found-file\.txt$/,
    );

    expect(spawn).not.toHaveBeenCalled();
  });

  it("10MBを超えるファイルはエラーになること", async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);
    const filePath = join(dir, "target.txt");
    await Bun.write(filePath, Buffer.alloc(10 * 1024 * 1024 + 1));

    const spawn = vi.fn();
    const applyPatch = createApplyPatch({
      spawn,
      hasher: async (input) => input,
    });

    await expectRejectMessage(
      applyPatch(context, filePath, "patch content"),
      /^file size exceeds the 10 MB limit \(actual: /,
    );

    expect(spawn).not.toHaveBeenCalled();
  });

  it("git apply が失敗し内容が変わらない場合はエラーになること", async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);
    const filePath = join(dir, "target.txt");
    await Bun.write(filePath, "before");

    const spawn = vi.fn().mockResolvedValue({
      ...toSpawnResult({
        exitCode: 1,
        stdout: "",
        stderr: "patch failed",
      }),
    });
    const hasher = vi.fn(async (input: string) => input);
    const applyPatch = createApplyPatch({ spawn, hasher });

    await expectRejectMessage(
      applyPatch(context, filePath, "patch content"),
      new RegExp(
        `^git apply failed with exit code 1: ${escapeRegExp("patch failed")}$`,
      ),
    );

    expect(spawn).toHaveBeenCalledWith(
      ["git", "apply", "--whitespace=fix", "--include", filePath, "-"],
      { stdin: Buffer.from("patch content") },
    );
    expect(hasher).toHaveBeenCalled();
  });

  it("git apply が失敗しても内容が変わった場合はエラーにしないこと", async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);
    const filePath = join(dir, "target.txt");
    await Bun.write(filePath, "before");

    const spawn = vi.fn(async () => {
      await Bun.write(filePath, "after");
      return toSpawnResult({
        exitCode: 1,
        stdout: "",
        stderr: "apply warning",
      });
    });
    const hasher = vi.fn(async (input: string) => input);
    const applyPatch = createApplyPatch({
      spawn,
      hasher,
    });

    const result = await applyPatch(context, filePath, "patch content");
    expect(await Bun.file(filePath).text()).toBe("after");
    expect(result.file_path).toBe(filePath);
    expect(result.exit_code).toBe(1);
    expect(result.changed).toBe(true);
    expect(result.stderr).toBe("apply warning");
    expect(spawn).toHaveBeenCalledWith(
      ["git", "apply", "--whitespace=fix", "--include", filePath, "-"],
      { stdin: Buffer.from("patch content") },
    );
    expect(hasher).toHaveBeenCalled();
  });

  it("git apply が成功した場合は正常終了すること", async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);
    const filePath = join(dir, "target.txt");
    await Bun.write(filePath, "before");

    const spawn = vi.fn().mockResolvedValue({
      ...toSpawnResult({
        exitCode: 0,
        stdout: "",
        stderr: "",
      }),
    });
    const hasher = vi.fn(async (input: string) => input);
    const applyPatch = createApplyPatch({
      spawn,
      hasher,
    });

    const result = await applyPatch(context, filePath, "patch content");
    expect(await Bun.file(filePath).text()).toBe("before");
    expect(result.file_path).toBe(filePath);
    expect(result.exit_code).toBe(0);
    expect(result.changed).toBe(false);
    expect(result.stderr).toBe("");
    expect(spawn).toHaveBeenCalledWith(
      ["git", "apply", "--whitespace=fix", "--include", filePath, "-"],
      { stdin: Buffer.from("patch content") },
    );
    expect(hasher).toHaveBeenCalled();
  });
});
