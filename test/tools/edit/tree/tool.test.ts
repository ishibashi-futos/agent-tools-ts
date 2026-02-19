import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSecureTool, type ToolContext } from "../../../../src/factory";
import { tree } from "../../../../src/tools/edit/tree/tool";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "tree-tool-"));
};

const createContext = (workspaceRoot: string): ToolContext => {
  return {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { tree: "allow" }, defaultPolicy: "deny" },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

const createFixture = async (root: string): Promise<void> => {
  await mkdir(join(root, "alpha"), { recursive: true });
  await mkdir(join(root, "beta"), { recursive: true });
  await mkdir(join(root, ".hidden-dir"), { recursive: true });
  await writeFile(join(root, "root.txt"), "root");
  await writeFile(join(root, "alpha", "a.txt"), "a");
  await writeFile(join(root, ".hidden-file"), "hidden");

  try {
    await symlink(join(root, "alpha"), join(root, "alpha-link"));
  } catch {
    // 権限などでシンボリックリンクを作成できない環境では無視する
  }
};

describe("tree tool", () => {
  it("正常系: entry_kind 未指定時はディレクトリのみ返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await createFixture(workspaceRoot);

      const secureTree = createSecureTool(
        { name: "tree", isWriteOp: false },
        tree,
      );
      const context = createContext(workspaceRoot);

      const result = await secureTree(context, ".");

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      expect(result.data.root.kind).toBe("directory");
      const children = result.data.root.children ?? [];
      expect(children.length).toBe(2);
      expect(children.every((entry) => entry.kind === "directory")).toBe(true);
      expect(result.data.total_files).toBe(0);
      expect(result.data.total_symlinks).toBe(0);
      expect(result.data.scanned_entries).toBe(3);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("max_depth=0 のときルートのみ返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await createFixture(workspaceRoot);

      const secureTree = createSecureTool(
        { name: "tree", isWriteOp: false },
        tree,
      );
      const context = createContext(workspaceRoot);

      const result = await secureTree(context, ".", { max_depth: 0 });

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      expect(result.data.scanned_entries).toBe(1);
      expect(result.data.root.children).toBeUndefined();
      expect(result.data.root.truncated).toBe(true);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("max_entries 到達時に走査を停止すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await createFixture(workspaceRoot);

      const secureTree = createSecureTool(
        { name: "tree", isWriteOp: false },
        tree,
      );
      const context = createContext(workspaceRoot);

      const result = await secureTree(context, ".", {
        entry_kind: "all",
        max_entries: 2,
      });

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      expect(result.data.limit_reached).toBe(true);
      expect(result.data.scanned_entries).toBe(2);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("include_hidden=false のときドット始まりのエントリを除外すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await createFixture(workspaceRoot);

      const secureTree = createSecureTool(
        { name: "tree", isWriteOp: false },
        tree,
      );
      const context = createContext(workspaceRoot);

      const result = await secureTree(context, ".", {
        entry_kind: "all",
        include_hidden: false,
      });

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      const rootChildren = result.data.root.children ?? [];
      expect(rootChildren.some((entry) => entry.name.startsWith("."))).toBe(
        false,
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("ファイルを path 指定した場合に NOT_DIRECTORY を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await createFixture(workspaceRoot);

      const secureTree = createSecureTool(
        { name: "tree", isWriteOp: false },
        tree,
      );
      const context = createContext(workspaceRoot);

      const result = await secureTree(context, "root.txt");

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("NOT_DIRECTORY");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
