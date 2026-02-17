import {
  createSecureTool,
  type ToolContext,
  type ToolMetadata,
} from "./factory";
import { applyPatch } from "./tools/git/apply_patch";
import { SecurityBypass } from "./security/bypass";

// 各ドメインの生ロジックをインポート（後ほど各ディレクトリで実装）

/**
 * ツール定義と実装のペア
 */
interface ToolDefinition<T extends any[], R> {
  metadata: ToolMetadata & { description: string };
  handler: (context: ToolContext, ...args: T) => Promise<R> | R;
}

/**
 * ライブラリが提供する全ツールのカタログ
 */
export const ToolCatalog = {
  apply_patch: {
    metadata: {
      name: "apply_patch",
      isWriteOp: true,
      description:
        "Applies a unified diff patch to a file within the workspace.",
    },
    handler: applyPatch,
  },
} as const;

/**
 * 実行環境（Context）を紐付けた安全なツールセットを生成する
 */
export function createAgentToolkit(context: ToolContext) {
  return {
    applyPatch: createSecureTool(
      ToolCatalog.apply_patch.metadata,
      ToolCatalog.apply_patch.handler,
    ).bind(null, context),
  };
}

/**
 * セキュリティバイパス用のユーティリティ
 */
export { SecurityBypass };

/**
 * 型定義の再エクスポート
 */
export type { ToolContext } from "./factory";
export type { FileAccessMode } from "./sandbox/fs";
export type { SecurityPolicyConfig, AccessLevel } from "./security/policy";
