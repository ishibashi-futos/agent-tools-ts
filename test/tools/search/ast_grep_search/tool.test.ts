import { describe, expect, it, vi } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSecureTool, type ToolContext } from "../../../../src/factory";
import { AstGrepSearchError } from "../../../../src/tools/search/ast_grep_search/error";
import { createAstGrepSearch } from "../../../../src/tools/search/ast_grep_search/tool";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "ast-grep-search-tool-"));
};

const createContext = (workspaceRoot: string): ToolContext => {
  return {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { ast_grep_search: "allow" }, defaultPolicy: "deny" },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

describe("ast_grep_search tool", () => {
  it("正常系: 一致結果を返すこと", async () => {
    const workspaceRoot = await createTempDir();
    const mockUsecase = vi.fn().mockResolvedValue({
      query: {
        language: "typescript",
        rule: { pattern: "export default function $NAME() { $$$ }" },
      },
      root_path: ".",
      took_ms: 1,
      truncated: false,
      items: [
        {
          text: "export default function main() {}",
          file: "src/main.ts",
          range: {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 33 },
          },
        },
      ],
      warnings: [],
    });

    try {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      const secureAstGrepSearch = createSecureTool(
        { name: "ast_grep_search", isWriteOp: false },
        createAstGrepSearch({ usecase: mockUsecase }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureAstGrepSearch(context, {
        language: "typescript",
        rule: { pattern: "export default function $NAME() { $$$ }" },
      });

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      expect(mockUsecase).toHaveBeenCalled();
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.file).toBe("src/main.ts");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("入力不正時に INVALID_ARGUMENT を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureAstGrepSearch = createSecureTool(
        { name: "ast_grep_search", isWriteOp: false },
        createAstGrepSearch(),
      );
      const context = createContext(workspaceRoot);

      const result = await secureAstGrepSearch(context, {
        language: "",
        rule: { pattern: "const $A = $B" },
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

  it("存在しない root_path で NOT_FOUND を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureAstGrepSearch = createSecureTool(
        { name: "ast_grep_search", isWriteOp: false },
        createAstGrepSearch(),
      );
      const context = createContext(workspaceRoot);

      const result = await secureAstGrepSearch(context, {
        language: "typescript",
        rule: { pattern: "const $A = $B" },
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

  it("sg 欠落時に DEPENDENCY_MISSING を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await writeFile(join(workspaceRoot, "main.ts"), "const a = 1;\n");
      const secureAstGrepSearch = createSecureTool(
        { name: "ast_grep_search", isWriteOp: false },
        createAstGrepSearch({
          usecase: vi
            .fn()
            .mockRejectedValue(
              new AstGrepSearchError(
                "DEPENDENCY_MISSING",
                "sg binary is not installed",
              ),
            ),
        }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureAstGrepSearch(context, {
        language: "typescript",
        rule: { pattern: "const $A = $B" },
      });

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("DEPENDENCY_MISSING");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rule 不正時に INVALID_RULE を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await writeFile(join(workspaceRoot, "main.ts"), "const a = 1;\n");
      const secureAstGrepSearch = createSecureTool(
        { name: "ast_grep_search", isWriteOp: false },
        createAstGrepSearch({
          usecase: vi
            .fn()
            .mockRejectedValue(
              new AstGrepSearchError("INVALID_RULE", "rule is invalid"),
            ),
        }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureAstGrepSearch(context, {
        language: "typescript",
        rule: { kind: null },
      });

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("INVALID_RULE");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("language 不正時に UNSUPPORTED_LANGUAGE を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await writeFile(join(workspaceRoot, "main.ts"), "const a = 1;\n");
      const secureAstGrepSearch = createSecureTool(
        { name: "ast_grep_search", isWriteOp: false },
        createAstGrepSearch({
          usecase: vi
            .fn()
            .mockRejectedValue(
              new AstGrepSearchError(
                "UNSUPPORTED_LANGUAGE",
                "language is unsupported",
              ),
            ),
        }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureAstGrepSearch(context, {
        language: "unknown-lang",
        rule: { pattern: "const $A = $B" },
      });

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("UNSUPPORTED_LANGUAGE");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("timeout 時に TIMEOUT を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await writeFile(join(workspaceRoot, "main.ts"), "const a = 1;\n");
      const secureAstGrepSearch = createSecureTool(
        { name: "ast_grep_search", isWriteOp: false },
        createAstGrepSearch({
          usecase: vi
            .fn()
            .mockRejectedValue(
              new AstGrepSearchError("TIMEOUT", "search timed out"),
            ),
        }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureAstGrepSearch(context, {
        language: "typescript",
        rule: { pattern: "const $A = $B" },
        timeout_ms: 1,
      });

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("TIMEOUT");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
