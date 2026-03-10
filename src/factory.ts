import * as os from "node:os";
import type { ToolErrorEnvelope } from "./errors/envelope";
import { type FileAccessMode, SandboxFS } from "./sandbox/fs";
import { SandboxPath } from "./sandbox/path";
import { SecurityPolicy, type SecurityPolicyConfig } from "./security/policy";

/**
 * ツールの実行コンテキスト定義
 */
export interface ToolContext<TToolName extends string = string> {
  workspaceRoot: string;
  writeScope: FileAccessMode;
  policy: SecurityPolicyConfig<TToolName>;
  env: {
    platform: NodeJS.Platform;
    osRelease: string;
  };
}

/**
 * ツールのメタデータ
 */
export interface ToolMetadata {
  name: string;
  isWriteOp: boolean;
}

/**
 * ツール実行時の戻り値定義
 */
export type ToolResultStatus = "success" | "failure" | "denied";
export interface ToolSuccess<R> {
  status: "success";
  data: R;
}

export interface ToolError {
  status: "failure" | "denied";
  reason: "policy" | "sandbox" | "runtime";
  message: string;
  error: ToolErrorEnvelope;
}

export type ToolResult<R = unknown> = ToolSuccess<R> | ToolError;

/**
 * コンテキスト生成用パラメータ
 */
export interface CreateToolContextParams {
  workspaceRoot: string;
  writeScope?: FileAccessMode;
  policy?: SecurityPolicyConfig;
}

/**
 * 環境情報を自動取得して実行コンテキストを生成するファクトリ関数
 */
export function createToolContext<TToolName extends string = string>(
  params: CreateToolContextParams & {
    policy?: SecurityPolicyConfig<TToolName>;
  },
): ToolContext<TToolName> {
  return {
    workspaceRoot: params.workspaceRoot,
    writeScope: params.writeScope ?? "workspace-write",
    policy: params.policy ?? { tools: {}, defaultPolicy: "deny" },
    env: {
      platform: os.platform(),
      osRelease: os.release(),
    },
  };
}

/**
 * 高階関数により、生のドメイン関数にガードレールを適用する
 */
export function createSecureTool<T extends unknown[], R>(
  metadata: ToolMetadata,
  fn: (context: ToolContext, ...args: T) => Promise<R> | R,
) {
  const toErrorEnvelope = (
    reason: ToolError["reason"],
    message: string,
  ): ToolErrorEnvelope => {
    if (reason === "policy") {
      return {
        code: "POLICY_DENIED",
        message,
        retriable: false,
        details: {},
      };
    }
    if (reason === "sandbox") {
      return {
        code: "SANDBOX_VIOLATION",
        message,
        retriable: false,
        details: {},
      };
    }
    return {
      code: "RUNTIME_ERROR",
      message,
      retriable: true,
      details: {},
    };
  };

  return async (context: ToolContext, ...args: T): Promise<ToolResult<R>> => {
    const { name, isWriteOp } = metadata;

    try {
      // 入力引数の基本検証（型不正は runtime エラーとして扱う）
      if (
        args.length > 0 &&
        typeof args[0] !== "string" &&
        !(
          typeof args[0] === "object" &&
          args[0] !== null &&
          !Array.isArray(args[0])
        )
      ) {
        throw new Error("Invalid path argument");
      }
      // --- Security & Sandbox Check ---
      try {
        SecurityPolicy.authorize(name, context.policy);
        SandboxFS.validateAccess(context.writeScope, isWriteOp);

        if (typeof args[0] === "string") {
          const normalizedPathArg = args[0].replace(/\\/g, "/");
          (args as unknown[])[0] = SandboxPath.resolveInWorkspace(
            normalizedPathArg,
            context.workspaceRoot,
          );
        } else if (
          typeof args[0] === "object" &&
          args[0] !== null &&
          !Array.isArray(args[0])
        ) {
          const input = args[0] as Record<string, unknown>;
          if (typeof input.cwd === "string") {
            const normalizedCwd = input.cwd.replace(/\\/g, "/");
            (args as unknown[])[0] = {
              ...input,
              cwd: SandboxPath.resolveInWorkspace(
                normalizedCwd,
                context.workspaceRoot,
              ),
            };
          } else if (typeof input.root_path === "string") {
            const normalizedRootPath = input.root_path.replace(/\\/g, "/");
            (args as unknown[])[0] = {
              ...input,
              root_path: SandboxPath.resolveInWorkspace(
                normalizedRootPath,
                context.workspaceRoot,
              ),
            };
          }
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        const deniedReason = message.includes("Policy") ? "policy" : "sandbox";
        // 拒否時は ToolError 型を返す
        return {
          status: "denied",
          reason: deniedReason,
          message,
          error: toErrorEnvelope(deniedReason, message),
        };
      }

      // --- Execution ---
      const result = await fn(context, ...args);

      // 成功時は ToolSuccess 型を返す
      return { status: "success", data: result };
    } catch (e: unknown) {
      // 実行時エラーは failure
      return {
        status: "failure",
        reason: "runtime",
        message: e instanceof Error ? e.message : String(e),
        error: toErrorEnvelope(
          "runtime",
          e instanceof Error ? e.message : String(e),
        ),
      };
    }
  };
}
