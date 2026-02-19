import {
  createSecureTool,
  type ToolContext,
  type ToolMetadata,
} from "./factory";
import { applyPatch } from "./tools/edit/apply_patch/tool";
import { readFile } from "./tools/edit/read_file/tool";
import { tree } from "./tools/edit/tree/tool";
import { execCommand } from "./tools/exec/exec_command/tool";
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
  exec_command: {
    metadata: {
      name: "exec_command",
      isWriteOp: false,
      description:
        "Runs a command once in the workspace and returns stdout, stderr, and exit code.",
    },
    handler: execCommand,
  },
  tree: {
    metadata: {
      name: "tree",
      isWriteOp: false,
      description:
        "Returns a workspace tree: directories only or directories with files.",
    },
    handler: tree,
  },
  read_file: {
    metadata: {
      name: "read_file",
      isWriteOp: false,
      description:
        "Reads a UTF-8 text file in the workspace and returns a line-limited content window.",
    },
    handler: readFile,
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
    execCommand: createSecureTool(
      ToolCatalog.exec_command.metadata,
      ToolCatalog.exec_command.handler,
    ).bind(null, context),
    tree: createSecureTool(
      ToolCatalog.tree.metadata,
      ToolCatalog.tree.handler,
    ).bind(null, context),
    readFile: createSecureTool(
      ToolCatalog.read_file.metadata,
      ToolCatalog.read_file.handler,
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
export { createToolContext, type ToolContext } from "./factory";
export type { FileAccessMode } from "./sandbox/fs";
export type { SecurityPolicyConfig, AccessLevel } from "./security/policy";
