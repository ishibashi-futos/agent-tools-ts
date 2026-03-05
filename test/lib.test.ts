import { beforeEach, describe, expect, it, vi } from "bun:test";
import { resolve } from "node:path";
import {
  createAgentToolkit,
  SecurityBypass,
  ToolCatalog,
  type ToolContext,
} from "../src/lib";

describe("Library Integration (Toolkit & Guardrails)", () => {
  const workspaceRoot = resolve("./test-workspace");
  const mutableToolCatalog = ToolCatalog as {
    [K in keyof typeof ToolCatalog]: {
      metadata: (typeof ToolCatalog)[K]["metadata"];
      handler: (typeof ToolCatalog)[K]["handler"];
    };
  };

  // 各テスト前にハンドラーのモックをリセット
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("正常系: 適切なコンテキストでパッチ適用が成功すること", async () => {
    const mockHandler = vi.fn().mockResolvedValue("Apply Success");
    // 型安全にハンドラーを差し替え
    mutableToolCatalog.apply_patch.handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.tools.apply_patch("src/main.ts", "patch data");

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
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.tools.apply_patch("src/main.ts", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("policy");
    expect(result.message).toMatch(/Access denied/);
    expect(result.error).toEqual({
      code: "POLICY_DENIED",
      message: expect.stringMatching(/Access denied/),
      retriable: false,
      details: {},
    });
  });

  it("エッジケース: Read-onlyモード時に書き込み操作をブロックすること", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "read-only",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "allow" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.tools.apply_patch("src/main.ts", "data");

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("sandbox");
    expect(result.message).toMatch(/Write operation denied/);
    expect(result.error.code).toBe("SANDBOX_VIOLATION");
  });

  it("エッジケース: ディレクトリトラバーサル攻撃を遮断すること", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "allow" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.tools.apply_patch(
      "../../../etc/passwd",
      "data",
    );

    expect(result.status).toBe("denied");
    if (result.status !== "denied")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("sandbox");
    expect(result.message).toMatch(/outside of workspace/);
    expect(result.error.code).toBe("SANDBOX_VIOLATION");
  });

  it("高度なケース: SecurityBypassを使用すると拒否設定を無視できること", async () => {
    const mockHandler = vi.fn().mockResolvedValue("Bypassed Success");
    mutableToolCatalog.apply_patch.handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "deny" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);

    // 1. 通常は denied
    const deniedResult = await toolkit.tools.apply_patch("src/main.ts", "data");
    expect(deniedResult.status).toBe("denied");

    // 2. バイパス実行
    const successResult = await SecurityBypass.run(async () => {
      return await toolkit.tools.apply_patch("src/main.ts", "data");
    });

    expect(successResult.status).toBe("success");
  });

  it("エッジケース: 不正なパス引数（null等）に対して failure を返すこと", async () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { apply_patch: "allow" }, defaultPolicy: "allow" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);

    // 型安全性を無視して null を渡す
    const result = await toolkit.tools.apply_patch(
      null as unknown as string,
      "data",
    );

    expect(result.status).toBe("failure");
    if (result.status !== "failure")
      throw new Error("Expected denied but got success");
    expect(result.reason).toBe("runtime");
    expect(result.error).toEqual({
      code: "RUNTIME_ERROR",
      message: "Invalid path argument",
      retriable: true,
      details: {},
    });
  });

  it("正常系: read_file が ToolCatalog と toolkit に登録され実行できること", async () => {
    const mockHandler = vi.fn().mockResolvedValue({
      path: "src/main.ts",
      content: "hello",
      truncated: false,
      next_start_line: null,
      meta: {
        byte_length: 5,
        line_count: 1,
        returned_line_count: 1,
        mtime_ms: 1,
      },
    });
    mutableToolCatalog.read_file.handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { read_file: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.tools.read_file("src/main.ts");

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("Expected success but got non-success");
    }

    expect(mockHandler).toHaveBeenCalledWith(
      context,
      resolve(workspaceRoot, "src/main.ts"),
    );
    expect(result.data.path).toBe("src/main.ts");
  });

  it("正常系: git_status_summary が ToolCatalog と toolkit に登録され実行できること", async () => {
    const mockHandler = vi.fn().mockResolvedValue({
      repository_root: workspaceRoot,
      branch: "main",
      raw: "## main\n",
    });
    mutableToolCatalog.git_status_summary.handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { git_status_summary: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.tools.git_status_summary();

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("Expected success but got non-success");
    }

    expect(mockHandler).toHaveBeenCalledWith(context);
    expect(result.data.branch).toBe("main");
  });

  it("正常系: write_file が ToolCatalog と toolkit に登録され実行できること", async () => {
    const mockHandler = vi.fn().mockResolvedValue({
      path: "src/new.ts",
      created: true,
      bytes_written: 12,
    });
    mutableToolCatalog.write_file.handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { write_file: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.tools.write_file("src/new.ts", "const x = 1;");

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("Expected success but got non-success");
    }

    expect(mockHandler).toHaveBeenCalledWith(
      context,
      resolve(workspaceRoot, "src/new.ts"),
      "const x = 1;",
    );
    expect(result.data.path).toBe("src/new.ts");
  });

  it("正常系: invoke で read_file を実行し role/name/content を返すこと", async () => {
    const mockHandler = vi.fn().mockResolvedValue({
      path: "src/main.ts",
      content: "hello",
      truncated: false,
      next_start_line: null,
      meta: {
        byte_length: 5,
        line_count: 1,
        returned_line_count: 1,
        mtime_ms: 1,
      },
    });
    mutableToolCatalog.read_file.handler = mockHandler;

    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: { tools: { read_file: "allow" }, defaultPolicy: "deny" },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const result = await toolkit.invoke("read_file", { path: "src/main.ts" });

    expect(result.role).toBe("function");
    expect(result.name).toBe("read_file");
    expect(result.content.path).toBe("src/main.ts");
    expect(mockHandler).toHaveBeenCalledWith(
      context,
      resolve(workspaceRoot, "src/main.ts"),
      {
        start_line: undefined,
        max_lines: undefined,
      },
    );
  });

  it("正常系: getAllowedTools は defaultPolicy=deny で allow 指定のみ返すこと", () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: {
        tools: { read_file: "allow", exec_command: "allow" },
        defaultPolicy: "deny",
      },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const tools = toolkit.getAllowedTools();
    const names = tools.map((tool) => tool.function.name);

    expect(names).toEqual(["exec_command", "read_file"]);
  });

  it("正常系: getAllowedTools は defaultPolicy=allow で deny 指定を除外すること", () => {
    const context: ToolContext = {
      workspaceRoot,
      writeScope: "workspace-write",
      policy: {
        tools: { exec_command: "deny" },
        defaultPolicy: "allow",
      },
      env: { platform: "linux", osRelease: "5.4.0" },
    };

    const toolkit = createAgentToolkit(context);
    const tools = toolkit.getAllowedTools();
    const names = tools.map((tool) => tool.function.name);

    expect(names).not.toContain("exec_command");
    expect(names).toContain("apply_patch");
    expect(names).toContain("write_file");
    expect(names).toContain("tree");
  });
});
