import { describe, it, expect } from "bun:test";
import { createSecureTool, type ToolContext } from "../src/factory";
import { resolve } from "node:path";

describe("factory.ts (createSecureTool)", () => {
  const workspaceRoot = resolve("/test/workspace");
  const defaultContext: ToolContext = {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { test_tool: "allow" }, defaultPolicy: "deny" },
    env: { platform: "darwin", osRelease: "20.0.0" },
  };
  const mockDomainFn = async (
    context: ToolContext,
    path: string,
    data: string,
  ) => `Processed ${path}`;

  it("Security Layer: ポリシー拒否時に status: 'denied' を返すこと", async () => {
    const deniedContext = {
      ...defaultContext,
      policy: { tools: { test_tool: "deny" }, defaultPolicy: "deny" },
    };
    const secureTool = createSecureTool(
      { name: "test_tool", isWriteOp: true },
      mockDomainFn,
    );

    const result = await secureTool(
      deniedContext as any,
      "src/index.ts",
      "data",
    );

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("policy");
  });

  it("Sandbox FS Layer: Read-onlyモードでの書き込み時に status: 'denied' を返すこと", async () => {
    const readOnlyContext = { ...defaultContext, writeScope: "read-only" };
    const secureTool = createSecureTool(
      { name: "test_tool", isWriteOp: true },
      mockDomainFn,
    );

    const result = await secureTool(
      readOnlyContext as any,
      "src/index.ts",
      "data",
    );

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");

    expect(result.reason).toBe("sandbox");
    expect(result.message).toMatch(/Write operation denied/);
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
  });
});
