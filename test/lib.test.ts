import { describe, it, expect, vi, beforeEach } from "bun:test";
import {
  createAgentToolkit,
  SecurityBypass,
  type ToolContext,
  ToolCatalog,
} from "../src/lib";
import { resolve } from "node:path";

describe("Library Integration (Toolkit & Guardrails)", () => {
  const workspaceRoot = resolve("./test-workspace");

  // 各テスト前にハンドラーのモックをリセット
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("正常系: 適切なコンテキストでパッチ適用が成功すること", async () => {
    const mockHandler = vi.fn().mockResolvedValue("Apply Success");
    // 型安全にハンドラーを差し替え
    (ToolCatalog.apply_patch as any).handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "deny" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.applyPatch("src/main.ts", "patch data");

    // 型絞り込み
    expect(result.status).toBe("success");
    if (result.status !== "success")
      throw new Error("Expected denied but got success");

    expect(mockHandler).toHaveBeenCalledWith(
      context,
      resolve(workspaceRoot, "src/main.ts"),
      "patch data",
    );
  });

  it("エッジケース: ポリシーでdenyされているツールは denied を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "deny" }, defaultPolicy: "allow" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.applyPatch("src/main.ts", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("policy");
    expect(result.message).toMatch(/Access denied/);
  });

  it("エッジケース: Read-onlyモード時に書き込み操作をブロックすること", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "read-only",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "allow" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.applyPatch("src/main.ts", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("sandbox");
    expect(result.message).toMatch(/Write operation denied/);
  });

  it("エッジケース: ディレクトリトラバーサル攻撃を遮断すること", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "allow" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.applyPatch("../../../etc/passwd", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("sandbox");
    expect(result.message).toMatch(/outside of workspace/);
  });

  it("高度なケース: SecurityBypassを使用すると拒否設定を無視できること", async () => {
    const mockHandler = vi.fn().mockResolvedValue("Bypassed Success");
    (ToolCatalog.apply_patch as any).handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "deny" }, defaultPolicy: "deny" },
    };

    const toolkit = createAgentToolkit(context);

    // 1. 通常は denied
    const deniedResult = await toolkit.applyPatch("src/main.ts", "data");
    expect(deniedResult.status).toBe("denied");

    // 2. バイパス実行
    const successResult = await SecurityBypass.run(async () => {
      return await toolkit.applyPatch("src/main.ts", "data");
    });

    expect(successResult.status).toBe("success");
  });

  it("エッジケース: 不正なパス引数（null等）に対して failure を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "allow" },
    };

    const toolkit = createAgentToolkit(context);

    // 型安全性を無視して null を渡す
    const result = await toolkit.applyPatch(null as any, "data");

    expect(result.status).toBe("failure");
    if (result.status !== "failure")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("runtime");
  });
});
