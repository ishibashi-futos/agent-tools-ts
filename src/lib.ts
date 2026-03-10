import {
  type ToolContext as BaseToolContext,
  createToolContext as createBaseToolContext,
  createSecureTool,
} from "./factory";
import {
  type AllowedToolName,
  TOOL_DEFINITIONS,
} from "./registory/definitions";
import { selectAllowedTools } from "./registory/select";
import type { FileAccessMode } from "./sandbox/fs";
import { SecurityBypass } from "./security/bypass";
import type { SecurityPolicyConfig } from "./security/policy";
import { createInvoke } from "./toolkit/invoke/index";
import { applyPatch } from "./tools/edit/apply_patch/tool";
import { readFile } from "./tools/edit/read_file/tool";
import { tree } from "./tools/edit/tree/tool";
import { writeFile } from "./tools/edit/write_file/tool";
import { execCommand } from "./tools/exec/exec_command/tool";
import { gitStatusSummary } from "./tools/git/git_status_summary/tool";
import { astGrepSearch } from "./tools/search/ast_grep_search/tool";
import { regexpSearch } from "./tools/search/regexp_search/tool";

// 各ドメインの生ロジックをインポート（後ほど各ディレクトリで実装）

type ToolName = AllowedToolName;
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
  write_file: {
    metadata: {
      name: "write_file",
      isWriteOp: true,
      description:
        "Writes UTF-8 text to a file in the workspace. Use this for full content writes or creating new files.",
    },
    handler: writeFile,
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
  regexp_search: {
    metadata: {
      name: "regexp_search",
      isWriteOp: false,
      description:
        "Searches workspace text files with a regular expression and returns deterministic match locations.",
    },
    handler: regexpSearch,
  },
  ast_grep_search: {
    metadata: {
      name: "ast_grep_search",
      isWriteOp: false,
      description:
        "Searches source files with ast-grep and returns raw structured matches.",
    },
    handler: astGrepSearch,
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
  const tools = {
    apply_patch: createSecureTool(
      ToolCatalog.apply_patch.metadata,
      ToolCatalog.apply_patch.handler,
    ).bind(null, context),
    exec_command: createSecureTool(
      ToolCatalog.exec_command.metadata,
      ToolCatalog.exec_command.handler,
    ).bind(null, context),
    write_file: createSecureTool(
      ToolCatalog.write_file.metadata,
      ToolCatalog.write_file.handler,
    ).bind(null, context),
    tree: createSecureTool(
      ToolCatalog.tree.metadata,
      ToolCatalog.tree.handler,
    ).bind(null, context),
    read_file: createSecureTool(
      ToolCatalog.read_file.metadata,
      ToolCatalog.read_file.handler,
    ).bind(null, context),
    regexp_search: createSecureTool(
      ToolCatalog.regexp_search.metadata,
      ToolCatalog.regexp_search.handler,
    ).bind(null, context),
    ast_grep_search: createSecureTool(
      ToolCatalog.ast_grep_search.metadata,
      ToolCatalog.ast_grep_search.handler,
    ).bind(null, context),
    git_status_summary: createSecureTool(
      ToolCatalog.git_status_summary.metadata,
      ToolCatalog.git_status_summary.handler,
    ).bind(null, context),
  };

  return {
    tools,
    invoke: createInvoke({ context, catalog: ToolCatalog }),
    getAllowedTools: () => selectAllowedTools(TOOL_DEFINITIONS, context.policy),
  };
}

/**
 * セキュリティバイパス用のユーティリティ
 */
export { SecurityBypass };

export type { ToolErrorEnvelope } from "./errors/envelope";
export type { AllowedToolName } from "./registory/definitions";
/**
 * 型定義の再エクスポート
 */
export type { FileAccessMode } from "./sandbox/fs";
export type { AccessLevel, SecurityPolicyConfig } from "./security/policy";
export type { InvokeToolErrorCode } from "./toolkit/invoke/error";
export type {
  Invoke,
  ToolArgsByName,
  ToolkitInvokeOutput,
  ToolResultByName,
} from "./toolkit/invoke/index";
