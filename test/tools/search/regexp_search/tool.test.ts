import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSecureTool, type ToolContext } from "../../../../src/factory";
import { regexpSearch } from "../../../../src/tools/search/regexp_search/tool";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "regexp-search-tool-"));
};

const createContext = (workspaceRoot: string): ToolContext => {
  return {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { regexp_search: "allow" }, defaultPolicy: "deny" },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

describe("regexp_search tool", () => {
  it("正常系: 一致結果を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await writeFile(
        join(workspaceRoot, "src", "main.ts"),
        "const a = 1;\n// TODO(task)\nconst b = 2;\n",
      );

      const secureRegexpSearch = createSecureTool(
        { name: "regexp_search", isWriteOp: false },
        regexpSearch,
      );
      const context = createContext(workspaceRoot);

      const result = await secureRegexpSearch(context, {
        pattern: "TODO\\(.*\\)",
      });

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      expect(result.data.root_path).toBe(".");
      expect(result.data.items).toEqual([
        {
          path: "src/main.ts",
          line: 2,
          column: 4,
          match: "TODO(task)",
          line_text: "// TODO(task)",
        },
      ]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("入力不正時に INVALID_ARGUMENT を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureRegexpSearch = createSecureTool(
        { name: "regexp_search", isWriteOp: false },
        regexpSearch,
      );
      const context = createContext(workspaceRoot);

      const result = await secureRegexpSearch(context, {
        pattern: "abc",
        flags: "x",
      });

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("INVALID_ARGUMENT");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("不正な正規表現で INVALID_REGEX を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureRegexpSearch = createSecureTool(
        { name: "regexp_search", isWriteOp: false },
        regexpSearch,
      );
      const context = createContext(workspaceRoot);

      const result = await secureRegexpSearch(context, {
        pattern: "(",
      });

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("INVALID_REGEX");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("存在しない root_path で NOT_FOUND を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureRegexpSearch = createSecureTool(
        { name: "regexp_search", isWriteOp: false },
        regexpSearch,
      );
      const context = createContext(workspaceRoot);

      const result = await secureRegexpSearch(context, {
        pattern: "const",
        root_path: "missing",
      });

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("NOT_FOUND");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("max_results 到達時に truncated=true を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await writeFile(
        join(workspaceRoot, "src", "main.ts"),
        "describe('a')\ndescribe('b')\ndescribe('c')\n",
      );

      const secureRegexpSearch = createSecureTool(
        { name: "regexp_search", isWriteOp: false },
        regexpSearch,
      );
      const context = createContext(workspaceRoot);

      const result = await secureRegexpSearch(context, {
        pattern: "describe\\(",
        max_results: 2,
      });

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }
      expect(result.data.truncated).toBe(true);
      expect(result.data.items).toHaveLength(2);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
