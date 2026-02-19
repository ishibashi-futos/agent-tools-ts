import {
  createSecureTool,
  createToolContext as createBaseToolContext,
  type ToolContext as BaseToolContext,
  type ToolMetadata,
} from "./factory";
import { applyPatch } from "./tools/edit/apply_patch/tool";
import { readFile } from "./tools/edit/read_file/tool";
import { tree } from "./tools/edit/tree/tool";
import { execCommand } from "./tools/exec/exec_command/tool";
import { gitStatusSummary } from "./tools/git/git_status_summary/tool";
import { SecurityBypass } from "./security/bypass";
import { TOOL_DEFINITIONS } from "./registory/definitions";
import { selectAllowedTools } from "./registory/select";
import type { SecurityPolicyConfig } from "./security/policy";
import type { FileAccessMode } from "./sandbox/fs";

// 各ドメインの生ロジックをインポート（後ほど各ディレクトリで実装）

/**
 * ツール定義と実装のペア
 */
interface ToolDefinition<T extends any[], R> {
  metadata: ToolMetadata & { description: string };
  handler: (context: ToolContext, ...args: T) => Promise<R> | R;
}

type ToolName = keyof typeof TOOL_DEFINITIONS;
export type ToolContext = BaseToolContext<ToolName>;
export type ToolPolicy = SecurityPolicyConfig<ToolName>;

type CreateToolContextParams = {
  workspaceRoot: string;
  writeScope?: FileAccessMode;
  policy?: ToolPolicy;
};

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
  git_status_summary: {
    metadata: {
      name: "git_status_summary",
      isWriteOp: false,
      description:
        "Returns current git branch and raw porcelain status output for a workspace directory.",
    },
    handler: gitStatusSummary,
  },
} as const;

export function createToolContext(
  params: CreateToolContextParams,
): ToolContext {
  return createBaseToolContext<ToolName>(params);
}

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
    gitStatusSummary: createSecureTool(
      ToolCatalog.git_status_summary.metadata,
      ToolCatalog.git_status_summary.handler,
    ).bind(null, context),
    getAllowedTools: () => selectAllowedTools(TOOL_DEFINITIONS, context.policy),
  };
}

/**
 * セキュリティバイパス用のユーティリティ
 */
export { SecurityBypass };

/**
 * 型定義の再エクスポート
 */
export type { FileAccessMode } from "./sandbox/fs";
export type { SecurityPolicyConfig, AccessLevel } from "./security/policy";
