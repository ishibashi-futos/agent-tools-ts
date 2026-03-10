import { describe, expect, it, vi } from "bun:test";
import { resolve } from "node:path";
import {
  type AllowedToolName,
  ToolCatalog,
  type ToolContext,
} from "../../src/lib";
import { InvokeToolError } from "../../src/toolkit/invoke/error";
import { createInvoke } from "../../src/toolkit/invoke/index";

describe("createInvoke", () => {
  const workspaceRoot = resolve("./test-workspace");
  const mutableToolCatalog = ToolCatalog as {
    [K in keyof typeof ToolCatalog]: {
      metadata: (typeof ToolCatalog)[K]["metadata"];
      handler: (typeof ToolCatalog)[K]["handler"];
    };
  };

  it("未登録ツール名は TOOL_NOT_FOUND を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: {}, defaultPolicy: "allow" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };
    const invoke = createInvoke({ context, catalog: ToolCatalog });

    await expect(
      invoke("unknown_tool" as unknown as AllowedToolName, {}),
    ).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND",
      tool_name: "unknown_tool",
    });
  });

  it("policy deny のツールは TOOL_NOT_ALLOWED を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { read_file: "deny" }, defaultPolicy: "allow" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };
    const invoke = createInvoke({ context, catalog: ToolCatalog });

    await expect(
      invoke("read_file", { path: "src/lib.ts" }),
    ).rejects.toMatchObject({
      code: "TOOL_NOT_ALLOWED",
      tool_name: "read_file",
    });
  });

  it("read-only で書き込みツールを実行した場合は TOOL_NOT_ALLOWED を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "read-only",
      policy: { tools: { write_file: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };
    const invoke = createInvoke({ context, catalog: ToolCatalog });

    await expect(
      invoke("write_file", {
        path: "tmp.txt",
        content: "hello",
      }),
    ).rejects.toMatchObject({
      code: "TOOL_NOT_ALLOWED",
      tool_name: "write_file",
    });
  });

  it("args が object 以外の場合は INVALID_TOOL_ARGUMENTS_TYPE を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { read_file: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };
    const invoke = createInvoke({ context, catalog: ToolCatalog });

    try {
      await invoke("read_file", 123 as unknown as { path: string });
      throw new Error("Expected invoke to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvokeToolError);
      const invokeError = error as InvokeToolError;
      expect(invokeError.code).toBe("INVALID_TOOL_ARGUMENTS_TYPE");
      expect(invokeError.tool_name).toBe("read_file");
      expect(invokeError.toEnvelope()).toEqual({
        code: "INVALID_TOOL_ARGUMENTS_TYPE",
        message: "args must be an object",
        retriable: false,
        details: { tool_name: "read_file" },
      });
    }
  });

  it("apply_patch は arguments.patch をハンドラーに渡すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const originalHandler = ToolCatalog.apply_patch.handler;
    const mockHandler = vi.fn().mockResolvedValue({
      file_path: resolve(workspaceRoot, "src/lib.ts"),
      exit_code: 0,
      changed: false,
      stderr: "",
    });
    mutableToolCatalog.apply_patch.handler = mockHandler;

    try {
      const invoke = createInvoke({ context, catalog: ToolCatalog });
      await invoke("apply_patch", {
        filePath: "src/lib.ts",
        patch: "@@ -1 +1 @@\n-old\n+new\n",
      });

      expect(mockHandler).toHaveBeenCalledWith(
        context,
        resolve(workspaceRoot, "src/lib.ts"),
        "@@ -1 +1 @@\n-old\n+new\n",
      );
    } finally {
      mutableToolCatalog.apply_patch.handler = originalHandler;
    }
  });

  it("exec_command は単一オブジェクト引数をハンドラーに渡すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { exec_command: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const originalHandler = ToolCatalog.exec_command.handler;
    const mockHandler = vi.fn().mockResolvedValue({
      cwd: resolve(workspaceRoot, "."),
      command: ["echo", "ok"],
      exit_code: 0,
      stdout: "ok\n",
      stderr: "",
      stdout_truncated: false,
      stderr_truncated: false,
      timed_out: false,
      duration_ms: 1,
    });
    mutableToolCatalog.exec_command.handler = mockHandler;

    try {
      const invoke = createInvoke({ context, catalog: ToolCatalog });
      await invoke("exec_command", {
        cwd: ".",
        command: ["echo", "ok"],
        shell_mode: "direct",
      });

      expect(mockHandler).toHaveBeenCalledWith(context, {
        cwd: resolve(workspaceRoot, "."),
        command: ["echo", "ok"],
        shell_mode: "direct",
      });
    } finally {
      mutableToolCatalog.exec_command.handler = originalHandler;
    }
  });

  it("task_create_many は単一オブジェクト引数をハンドラーに渡すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { task_create_many: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const originalHandler = ToolCatalog.task_create_many.handler;
    const mockHandler = vi.fn().mockResolvedValue({
      tasks: [
        {
          task_id: "00000000-0000-4000-8000-000000000000",
          status: "todo",
          title: "t1",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    mutableToolCatalog.task_create_many.handler = mockHandler;

    try {
      const invoke = createInvoke({ context, catalog: ToolCatalog });
      await invoke("task_create_many", {
        tasks: [{ title: "t1" }],
      });

      expect(mockHandler).toHaveBeenCalledWith(context, {
        tasks: [{ title: "t1" }],
      });
    } finally {
      mutableToolCatalog.task_create_many.handler = originalHandler;
    }
  });

  it("regexp_search は root_path を正規化した単一オブジェクト引数をハンドラーに渡すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { regexp_search: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const originalHandler = ToolCatalog.regexp_search.handler;
    const mockHandler = vi.fn().mockResolvedValue({
      query: {
        pattern: "TODO",
        flags: "",
      },
      root_path: "src",
      took_ms: 1,
      truncated: false,
      scanned_files: 0,
      items: [],
      warnings: [],
    });
    mutableToolCatalog.regexp_search.handler = mockHandler;

    try {
      const invoke = createInvoke({ context, catalog: ToolCatalog });
      await invoke("regexp_search", {
        pattern: "TODO",
        root_path: "src\\nested\\..",
      });

      expect(mockHandler).toHaveBeenCalledWith(context, {
        pattern: "TODO",
        root_path: resolve(workspaceRoot, "src"),
      });
    } finally {
      mutableToolCatalog.regexp_search.handler = originalHandler;
    }
  });

  it("ast_grep_search は root_path を正規化した単一オブジェクト引数をハンドラーに渡すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { ast_grep_search: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const originalHandler = ToolCatalog.ast_grep_search.handler;
    const mockHandler = vi.fn().mockResolvedValue({
      query: {
        language: "typescript",
        rule: { pattern: "const $A = $B" },
      },
      root_path: "src",
      took_ms: 1,
      truncated: false,
      items: [],
      warnings: [],
    });
    mutableToolCatalog.ast_grep_search.handler = mockHandler;

    try {
      const invoke = createInvoke({ context, catalog: ToolCatalog });
      await invoke("ast_grep_search", {
        language: "typescript",
        rule: { pattern: "const $A = $B" },
        root_path: "src\\nested\\..",
      });

      expect(mockHandler).toHaveBeenCalledWith(context, {
        language: "typescript",
        rule: { pattern: "const $A = $B" },
        root_path: resolve(workspaceRoot, "src"),
      });
    } finally {
      mutableToolCatalog.ast_grep_search.handler = originalHandler;
    }
  });
});
