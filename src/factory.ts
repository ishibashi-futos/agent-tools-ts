import { SecurityPolicy, type SecurityPolicyConfig } from "./security/policy";
import { SandboxPath } from "./sandbox/path";
import { SandboxFS, type FileAccessMode } from "./sandbox/fs";

/**
 * ツールの実行コンテキスト定義
 */
export interface ToolContext {
  workspaceRoot: string;
  writeScope: FileAccessMode;
  policy: SecurityPolicyConfig;
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
}

export type ToolResult<R = any> = ToolSuccess<R> | ToolError;

/**
 * 高階関数により、生のドメイン関数にガードレールを適用する
 */
export function createSecureTool<T extends any[], R>(
  metadata: ToolMetadata,
  fn: (context: ToolContext, ...args: T) => Promise<R> | R,
) {
  return async (context: ToolContext, ...args: T): Promise<ToolResult<R>> => {
    const { name, isWriteOp } = metadata;

    try {
      // 入力引数の基本検証（型不正は runtime エラーとして扱う）
      if (args.length > 0 && typeof args[0] !== "string") {
        throw new Error("Invalid path argument");
      }
      // --- Security & Sandbox Check ---
      try {
        SecurityPolicy.authorize(name, context.policy);
        SandboxFS.validateAccess(context.writeScope, isWriteOp);

        if (typeof args[0] === "string") {
          args[0] = SandboxPath.resolveInWorkspace(
            args[0],
            context.workspaceRoot,
          ) as any;
        }
      } catch (e: any) {
        // 拒否時は ToolError 型を返す
        return {
          status: "denied",
          reason: e.message.includes("Policy") ? "policy" : "sandbox",
          message: e.message,
        };
      }

      // --- Execution ---
      const result = await fn(context, ...args);

      // 成功時は ToolSuccess 型を返す
      return { status: "success", data: result };
    } catch (e: any) {
      // 実行時エラーは failure
      return {
        status: "failure",
        reason: "runtime",
        message: e instanceof Error ? e.message : String(e),
      };
    }
  };
}
