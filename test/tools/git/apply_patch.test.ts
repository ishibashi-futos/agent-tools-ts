import { afterEach, describe, expect, it, vi } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApplyPatch } from "../../../src/tools/git/apply_patch";
import type { ToolContext } from "../../../src/factory";

const context: ToolContext = {
  workspaceRoot: ".",
  writeScope: "workspace-write",
  policy: { tools: {}, defaultPolicy: "allow" },
  env: { platform: "linux", osRelease: "test" },
};

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "apply-patch-test-"));
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

    await expect(
      applyPatch(context, "/tmp/not-found-file.txt", "patch content"),
    ).rejects.toThrow("file not found: /tmp/not-found-file.txt");

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

    await expect(
      applyPatch(context, filePath, "patch content"),
    ).rejects.toThrow("file size exceeds the 10 MB limit");

    expect(spawn).not.toHaveBeenCalled();
  });

  it("git apply が失敗し内容が変わらない場合はエラーになること", async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);
    const filePath = join(dir, "target.txt");
    await Bun.write(filePath, "before");

    const spawn = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "patch failed",
    });
    const hasher = vi.fn(async (input: string) => input);
    const applyPatch = createApplyPatch({ spawn, hasher });

    await expect(
      applyPatch(context, filePath, "patch content"),
    ).rejects.toThrow("git apply failed with exit code 1: patch failed");

    expect(spawn).toHaveBeenCalledWith(
      ["git", "apply", "--whitespace=fix", "--include", filePath, "-"],
      { stdin: Buffer.from("patch content") },
    );
    expect(hasher).toHaveBeenCalledTimes(2);
  });

  it("git apply が失敗しても内容が変わった場合はエラーにしないこと", async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);
    const filePath = join(dir, "target.txt");
    await Bun.write(filePath, "before");

    const spawn = vi.fn(async () => {
      await Bun.write(filePath, "after");
      return {
        exitCode: 1,
        stdout: "",
        stderr: "apply warning",
      };
    });
    const applyPatch = createApplyPatch({
      spawn,
      hasher: async (input) => input,
    });

    await expect(
      applyPatch(context, filePath, "patch content"),
    ).resolves.toBeUndefined();
  });

  it("git apply が成功した場合は正常終了すること", async () => {
    const dir = await createTempDir();
    tempDirs.push(dir);
    const filePath = join(dir, "target.txt");
    await Bun.write(filePath, "before");

    const spawn = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
    const applyPatch = createApplyPatch({
      spawn,
      hasher: async (input) => input,
    });

    await expect(
      applyPatch(context, filePath, "patch content"),
    ).resolves.toBeUndefined();
  });
});
