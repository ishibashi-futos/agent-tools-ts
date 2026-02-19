import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSecureTool, type ToolContext } from "../../../../src/factory";
import { readFile } from "../../../../src/tools/edit/read_file/tool";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "read-file-tool-"));
};

const createContext = (workspaceRoot: string): ToolContext => {
  return {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { read_file: "allow" }, defaultPolicy: "deny" },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

const createSecureReadFile = () => {
  return createSecureTool({ name: "read_file", isWriteOp: false }, readFile);
};

const createLines = (count: number): string => {
  return Array.from({ length: count }, (_, index) => `line-${index + 1}`).join(
    "\n",
  );
};

describe("read_file tool", () => {
  it("正常系: 既存テキストファイルの内容とメタ情報を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await writeFile(join(workspaceRoot, "src", "main.ts"), "a\r\nb\r\nc");

      const result = await createSecureReadFile()(
        createContext(workspaceRoot),
        "src/main.ts",
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got non-success");
      }

      expect(result.data.path).toBe("src/main.ts");
      expect(result.data.content).toBe("a\nb\nc");
      expect(result.data.truncated).toBe(false);
      expect(result.data.next_start_line).toBeNull();
      expect(result.data.meta.line_count).toBe(3);
      expect(result.data.meta.returned_line_count).toBe(3);
      expect(result.data.meta.byte_length).toBeGreaterThan(0);
      expect(result.data.meta.mtime_ms).toBeGreaterThan(0);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("max_lines 未指定時は 200 行で切り詰めること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const filePath = join(workspaceRoot, "long.txt");
      await writeFile(filePath, createLines(250));

      const result = await createSecureReadFile()(
        createContext(workspaceRoot),
        "long.txt",
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got non-success");
      }

      const returnedLines = result.data.content.split("\n");
      expect(returnedLines.length).toBe(200);
      expect(result.data.truncated).toBe(true);
      expect(result.data.next_start_line).toBe(201);
      expect(result.data.meta.line_count).toBe(250);
      expect(result.data.meta.returned_line_count).toBe(200);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("start_line と max_lines 指定時に指定範囲のみ返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const filePath = join(workspaceRoot, "window.txt");
      await writeFile(filePath, createLines(20));

      const result = await createSecureReadFile()(
        createContext(workspaceRoot),
        "window.txt",
        { start_line: 5, max_lines: 3 },
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got non-success");
      }

      expect(result.data.content).toBe("line-5\nline-6\nline-7");
      expect(result.data.truncated).toBe(true);
      expect(result.data.next_start_line).toBe(8);
      expect(result.data.meta.returned_line_count).toBe(3);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("存在しないファイル指定時に NOT_FOUND を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const result = await createSecureReadFile()(
        createContext(workspaceRoot),
        "missing.txt",
      );

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("NOT_FOUND");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("ディレクトリ指定時に NOT_FILE を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "logs"), { recursive: true });

      const result = await createSecureReadFile()(
        createContext(workspaceRoot),
        "logs",
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

  it("1MiB を超えるファイル指定時に SIZE_LIMIT_EXCEEDED を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const filePath = join(workspaceRoot, "large.txt");
      await writeFile(filePath, Buffer.alloc(1024 * 1024 + 1, "a"));

      const result = await createSecureReadFile()(
        createContext(workspaceRoot),
        "large.txt",
      );

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("SIZE_LIMIT_EXCEEDED");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("バイナリファイル指定時に BINARY_NOT_SUPPORTED を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const filePath = join(workspaceRoot, "binary.bin");
      await writeFile(filePath, Buffer.from([0x41, 0x00, 0x42]));

      const result = await createSecureReadFile()(
        createContext(workspaceRoot),
        "binary.bin",
      );

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("BINARY_NOT_SUPPORTED");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
