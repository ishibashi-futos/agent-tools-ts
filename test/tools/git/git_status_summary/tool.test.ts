import { describe, expect, it, vi } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createSecureTool, type ToolContext } from "../../../../src/factory";
import { GitStatusSummaryError } from "../../../../src/tools/git/git_status_summary/error";
import { createGitStatusSummary } from "../../../../src/tools/git/git_status_summary/tool";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "git-status-summary-tool-"));
};

const createContext = (workspaceRoot: string): ToolContext => {
  return {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { git_status_summary: "allow" }, defaultPolicy: "deny" },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

describe("git_status_summary tool", () => {
  it("正常系: repository_root / branch / raw を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const mockUsecase = vi.fn(async (_context: ToolContext, cwd: string) => {
        return {
          repository_root: cwd,
          branch: "main",
          raw: "## main\n",
        };
      });

      const secureTool = createSecureTool(
        { name: "git_status_summary", isWriteOp: false },
        createGitStatusSummary({ usecase: mockUsecase as any }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureTool(context, ".");

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      expect(result.data.repository_root).toBe(workspaceRoot);
      expect(result.data.branch).toBe("main");
      expect(result.data.raw).toBe("## main\n");
      expect(mockUsecase).toHaveBeenCalledWith(context, workspaceRoot);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("cwd が存在しない場合に NOT_DIRECTORY を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureTool = createSecureTool(
        { name: "git_status_summary", isWriteOp: false },
        createGitStatusSummary({
          usecase: vi.fn(async () => {
            throw new Error("usecase should not be called");
          }) as any,
        }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureTool(context, "missing");

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }

      expect(result.message).toContain("NOT_DIRECTORY");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("usecase が NOT_GIT_REPOSITORY を投げた場合に伝播すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureTool = createSecureTool(
        { name: "git_status_summary", isWriteOp: false },
        createGitStatusSummary({
          usecase: vi.fn(async () => {
            throw new GitStatusSummaryError(
              "NOT_GIT_REPOSITORY",
              "not a git repository",
            );
          }) as any,
        }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureTool(context, ".");

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }

      expect(result.message).toContain("NOT_GIT_REPOSITORY");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("cwd 未指定時は workspaceRoot を対象にすること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const mockUsecase = vi.fn(async (_context: ToolContext, cwd: string) => {
        return {
          repository_root: cwd,
          branch: null,
          raw: "",
        };
      });

      const secureTool = createSecureTool(
        { name: "git_status_summary", isWriteOp: false },
        createGitStatusSummary({ usecase: mockUsecase as any }),
      );
      const context = createContext(workspaceRoot);

      const result = await secureTool(context);

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }

      expect(mockUsecase).toHaveBeenCalledWith(context, workspaceRoot);
      expect(result.data.repository_root).toBe(workspaceRoot);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("cwd の / と \\ の双方で同一ディレクトリが解決されること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src", "tools"), { recursive: true });

      const calledCwds: string[] = [];
      const mockUsecase = vi.fn(async (_context: ToolContext, cwd: string) => {
        calledCwds.push(cwd);
        return {
          repository_root: cwd,
          branch: null,
          raw: "",
        };
      });

      const secureTool = createSecureTool(
        { name: "git_status_summary", isWriteOp: false },
        createGitStatusSummary({ usecase: mockUsecase as any }),
      );
      const context = createContext(workspaceRoot);

      const slashResult = await secureTool(context, "src/tools");
      const backslashResult = await secureTool(context, "src\\tools");

      expect(slashResult.status).toBe("success");
      expect(backslashResult.status).toBe("success");

      expect(calledCwds.length).toBe(2);
      expect(calledCwds[0]).toBe(calledCwds[1]);
      expect(calledCwds[0]).toBe(resolve(workspaceRoot, "src/tools"));
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("Windows ドライブレター付き絶対パスを拒否すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const tool = createGitStatusSummary({
        usecase: vi.fn(async () => {
          throw new Error("usecase should not be called");
        }) as any,
      });
      const context = createContext(workspaceRoot);

      await expect(tool(context, "C:\\work")).rejects.toThrow(
        "INVALID_ARGUMENT",
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
