import { describe, expect, it } from "bun:test";
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
});
