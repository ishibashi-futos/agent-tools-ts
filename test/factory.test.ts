import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { createSecureTool, type ToolContext } from "../src/factory";

describe("factory.ts (createSecureTool)", () => {
  const workspaceRoot = resolve("/test/workspace");
  const defaultContext: ToolContext = {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { test_tool: "allow" }, defaultPolicy: "deny" },
    env: { platform: "darwin", osRelease: "20.0.0" },
  };
  const mockDomainFn = async (
    _context: ToolContext,
    path: string,
    _data: string,
  ) => `Processed ${path}`;

  it("Security Layer: ポリシー拒否時に status: 'denied' を返すこと", async () => {
    const deniedContext: ToolContext = {
      ...defaultContext,
      policy: { tools: { test_tool: "deny" }, defaultPolicy: "deny" },
    };
    const secureTool = createSecureTool(
      { name: "test_tool", isWriteOp: true },
      mockDomainFn,
    );

    const result = await secureTool(deniedContext, "src/index.ts", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("policy");
    expect(result.error).toEqual({
      code: "POLICY_DENIED",
      message: expect.stringMatching(/Access denied/),
      retriable: false,
      details: {},
    });
  });

  it("Sandbox FS Layer: Read-onlyモードでの書き込み時に status: 'denied' を返すこと", async () => {
    const readOnlyContext: ToolContext = {
      ...defaultContext,
      writeScope: "read-only",
    };
    const secureTool = createSecureTool(
      { name: "test_tool", isWriteOp: true },
      mockDomainFn,
    );

    const result = await secureTool(readOnlyContext, "src/index.ts", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");

    expect(result.reason).toBe("sandbox");
    expect(result.message).toMatch(/Write operation denied/);
    expect(result.error).toEqual({
      code: "SANDBOX_VIOLATION",
      message: expect.stringMatching(/Write operation denied/),
      retriable: false,
      details: {},
    });
  });

  it("Sandbox Path Layer: ワークスペース外アクセス時に status: 'denied' を返すこと", async () => {
    const secureTool = createSecureTool(
      { name: "test_tool", isWriteOp: false },
      mockDomainFn,
    );

    const result = await secureTool(defaultContext, "../outside.txt", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");

    expect(result.reason).toBe("sandbox");
    expect(result.message).toMatch(/outside of workspace/);
    expect(result.error).toEqual({
      code: "SANDBOX_VIOLATION",
      message: expect.stringMatching(/outside of workspace/),
      retriable: false,
      details: {},
    });
  });
});
