import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSecureTool, type ToolContext } from "../../../../src/factory";
import { writeFile as writeFileTool } from "../../../../src/tools/edit/write_file/tool";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "write-file-tool-"));
};

const createContext = (workspaceRoot: string): ToolContext => {
  return {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { write_file: "allow" }, defaultPolicy: "deny" },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

const createSecureWriteFile = () => {
  return createSecureTool(
    { name: "write_file", isWriteOp: true },
    writeFileTool,
  );
};

describe("write_file tool", () => {
  it("新規ファイルを書き込めること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const result = await createSecureWriteFile()(
        createContext(workspaceRoot),
        "test/new-file.txt",
        "hello",
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got non-success");
      }

      expect(result.data.path).toBe("test/new-file.txt");
      expect(result.data.created).toBe(true);
      expect(result.data.bytes_written).toBe(5);
      expect(
        await Bun.file(join(workspaceRoot, "test/new-file.txt")).text(),
      ).toBe("hello");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("既存ファイルを上書きできること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "test"), { recursive: true });
      await writeFile(join(workspaceRoot, "test", "existing.txt"), "before");

      const result = await createSecureWriteFile()(
        createContext(workspaceRoot),
        "test/existing.txt",
        "after",
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got non-success");
      }

      expect(result.data.path).toBe("test/existing.txt");
      expect(result.data.created).toBe(false);
      expect(
        await Bun.file(join(workspaceRoot, "test/existing.txt")).text(),
      ).toBe("after");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("path がディレクトリの場合に NOT_FILE を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "test"), { recursive: true });

      const result = await createSecureWriteFile()(
        createContext(workspaceRoot),
        "test",
        "x",
      );

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("NOT_FILE");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("path が空文字の場合にワークスペースルートへの書き込みとして NOT_FILE を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const result = await createSecureWriteFile()(
        createContext(workspaceRoot),
        "",
        "x",
      );

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("NOT_FILE");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
