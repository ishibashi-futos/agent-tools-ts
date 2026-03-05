import { describe, expect, it, vi } from "bun:test";
import { resolve } from "node:path";
import { createInvoke } from "../../src/toolkit/invoke/index";
import { InvokeToolError } from "../../src/toolkit/invoke/error";
import { ToolCatalog, type ToolContext } from "../../src/lib";

describe("createInvoke", () => {
  const workspaceRoot = resolve("./test-workspace");

  it("未登録ツール名は TOOL_NOT_FOUND を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: {}, defaultPolicy: "allow" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };
    const invoke = createInvoke({ context, catalog: ToolCatalog });

    await expect(invoke("unknown_tool" as any, {})).rejects.toMatchObject({
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

  it("args が object 以外の場合は INVALID_TOOL_ARGUMENTS_TYPE を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { read_file: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };
    const invoke = createInvoke({ context, catalog: ToolCatalog });

    try {
      await invoke("read_file", 123 as unknown as Record<string, unknown>);
      throw new Error("Expected invoke to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvokeToolError);
      const invokeError = error as InvokeToolError;
      expect(invokeError.code).toBe("INVALID_TOOL_ARGUMENTS_TYPE");
      expect(invokeError.tool_name).toBe("read_file");
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
    (ToolCatalog.apply_patch as any).handler = mockHandler;

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
      (ToolCatalog.apply_patch as any).handler = originalHandler;
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
    (ToolCatalog.exec_command as any).handler = mockHandler;

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
      (ToolCatalog.exec_command as any).handler = originalHandler;
    }
  });
});
