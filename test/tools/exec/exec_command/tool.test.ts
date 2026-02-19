import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSecureTool, type ToolContext } from "../../../../src/factory";
import { execCommand } from "../../../../src/tools/exec/exec_command/tool";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "exec-command-tool-"));
};

const createContext = (workspaceRoot: string): ToolContext => {
  return {
    workspaceRoot,
    writeScope: "workspace-write",
    policy: { tools: { exec_command: "allow" }, defaultPolicy: "deny" },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

describe("exec_command tool", () => {
  it("正常系: 実行結果を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureExecCommand = createSecureTool(
        { name: "exec_command", isWriteOp: false },
        execCommand,
      );
      const context = createContext(workspaceRoot);

      const result = await secureExecCommand(
        context,
        ".",
        [process.execPath, "-e", "console.log('hello')"],
        { shell_mode: "direct" },
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }
      expect(result.data.exit_code).toBe(0);
      expect(result.data.stdout.includes("hello")).toBe(true);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("cwd が存在しない場合に NOT_DIRECTORY を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureExecCommand = createSecureTool(
        { name: "exec_command", isWriteOp: false },
        execCommand,
      );
      const context = createContext(workspaceRoot);

      const result = await secureExecCommand(
        context,
        "missing",
        [process.execPath, "-e", "console.log('hello')"],
        { shell_mode: "direct" },
      );

      expect(result.status).toBe("failure");
      if (result.status !== "failure") {
        throw new Error("Expected failure but got success");
      }
      expect(result.message).toContain("NOT_DIRECTORY");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("command が不正な場合に INVALID_ARGUMENT を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureExecCommand = createSecureTool(
        { name: "exec_command", isWriteOp: false },
        execCommand,
      );
      const context = createContext(workspaceRoot);

      const result = await secureExecCommand(context, ".", [] as string[], {
        shell_mode: "direct",
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

  it("timeout_ms 超過時に timed_out=true を返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureExecCommand = createSecureTool(
        { name: "exec_command", isWriteOp: false },
        execCommand,
      );
      const context = createContext(workspaceRoot);

      const result = await secureExecCommand(
        context,
        ".",
        [process.execPath, "-e", "setTimeout(() => {}, 5000)"],
        {
          shell_mode: "direct",
          timeout_ms: 50,
        },
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }
      expect(result.data.timed_out).toBe(true);
      expect(result.data.exit_code).toBe(124);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("max_output_chars 超過時に stdout/stderr を打ち切ること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      const secureExecCommand = createSecureTool(
        { name: "exec_command", isWriteOp: false },
        execCommand,
      );
      const context = createContext(workspaceRoot);

      const result = await secureExecCommand(
        context,
        ".",
        [
          process.execPath,
          "-e",
          "console.log('x'.repeat(5000)); console.error('y'.repeat(5000));",
        ],
        {
          shell_mode: "direct",
          max_output_chars: 1_000,
        },
      );

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        throw new Error("Expected success but got failure");
      }
      expect(result.data.stdout.length).toBe(1_000);
      expect(result.data.stderr.length).toBe(1_000);
      expect(result.data.stdout_truncated).toBe(true);
      expect(result.data.stderr_truncated).toBe(true);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
