import { SandboxFS } from "../../sandbox/fs";
import { SandboxPath } from "../../sandbox/path";
import { SecurityPolicy } from "../../security/policy";
import type { ToolContext } from "../../factory";
import type {
  ApplyPatchInput,
  ApplyPatchOutput,
} from "../../tools/edit/apply_patch/types";
import type {
  ReadFileInput,
  ReadFileOutput,
} from "../../tools/edit/read_file/types";
import type { TreeInput, TreeOutput } from "../../tools/edit/tree/types";
import type {
  ExecCommandOptions,
  ExecCommandOutput,
} from "../../tools/exec/exec_command/types";
import type {
  GitStatusSummaryInput,
  GitStatusSummaryOutput,
} from "../../tools/git/git_status_summary/types";
import { InvokeToolError } from "./error";

export type ToolArgsByName = {
  apply_patch: ApplyPatchInput;
  exec_command: {
    cwd: string;
    command: string[];
    shell_mode?: ExecCommandOptions["shell_mode"];
    stdin?: ExecCommandOptions["stdin"];
    timeout_ms?: ExecCommandOptions["timeout_ms"];
    max_output_chars?: ExecCommandOptions["max_output_chars"];
  };
  tree: TreeInput;
  read_file: ReadFileInput;
  git_status_summary: GitStatusSummaryInput;
};

export type ToolResultByName = {
  apply_patch: ApplyPatchOutput;
  exec_command: ExecCommandOutput;
  tree: TreeOutput;
  read_file: ReadFileOutput;
  git_status_summary: GitStatusSummaryOutput;
};

type ToolName = keyof ToolArgsByName;

export type ToolkitInvokeOutput<TName extends ToolName> = {
  role: "function";
  name: TName;
  content: ToolResultByName[TName];
};

export type Invoke = <TName extends ToolName>(
  name: TName,
  args: Record<string, unknown>,
) => Promise<ToolkitInvokeOutput<TName>>;

type CatalogEntry<TName extends ToolName> = {
  metadata: {
    name: TName;
    isWriteOp: boolean;
  };
  handler: (
    context: ToolContext<ToolName>,
    ...args: any[]
  ) => Promise<ToolResultByName[TName]> | ToolResultByName[TName];
};

type InvokeCatalog = { [TName in ToolName]: CatalogEntry<TName> };

type ToolArgumentResolver = {
  [TName in ToolName]: (args: Record<string, unknown>) => unknown[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const TOOL_ARGUMENT_RESOLVERS: ToolArgumentResolver = {
  apply_patch: (args) => [args.filePath, args.content],
  exec_command: (args) => [
    args.cwd,
    args.command,
    {
      shell_mode: args.shell_mode,
      stdin: args.stdin,
      timeout_ms: args.timeout_ms,
      max_output_chars: args.max_output_chars,
    },
  ],
  tree: (args) => [
    args.path,
    {
      entry_kind: args.entry_kind,
      max_depth: args.max_depth,
      max_entries: args.max_entries,
      include_hidden: args.include_hidden,
      exclude: args.exclude,
    },
  ],
  read_file: (args) => [
    args.path,
    {
      start_line: args.start_line,
      max_lines: args.max_lines,
    },
  ],
  git_status_summary: (args) => [args.cwd],
};

const normalizeArgsForSandbox = (
  args: unknown[],
  workspaceRoot: string,
): unknown[] => {
  if (typeof args[0] !== "string") {
    return args;
  }

  const normalizedPathArg = args[0].replace(/\\/g, "/");
  const resolved = SandboxPath.resolveInWorkspace(
    normalizedPathArg,
    workspaceRoot,
  );
  const copied = [...args];
  copied[0] = resolved;
  return copied;
};

type InvokeParams = {
  context: ToolContext<ToolName>;
  catalog: InvokeCatalog;
};

export const createInvoke = ({ context, catalog }: InvokeParams): Invoke => {
  return async <TName extends ToolName>(
    name: TName,
    args: Record<string, unknown>,
  ): Promise<ToolkitInvokeOutput<TName>> => {
    if (!(name in catalog)) {
      throw new InvokeToolError(
        "TOOL_NOT_FOUND",
        `tool is not registered: ${String(name)}`,
        { tool_name: String(name) },
      );
    }
    const catalogEntry = catalog[name];

    try {
      SecurityPolicy.authorize(name, context.policy);
    } catch (error) {
      if (error instanceof Error) {
        throw new InvokeToolError("TOOL_NOT_ALLOWED", error.message, {
          tool_name: String(name),
        });
      }
      throw new InvokeToolError("TOOL_NOT_ALLOWED", String(error), {
        tool_name: String(name),
      });
    }

    if (!isRecord(args)) {
      throw new InvokeToolError(
        "INVALID_TOOL_ARGUMENTS_TYPE",
        "args must be an object",
        { tool_name: String(name) },
      );
    }

    SandboxFS.validateAccess(
      context.writeScope,
      catalogEntry.metadata.isWriteOp,
    );
    const rawArgs = TOOL_ARGUMENT_RESOLVERS[name](args);
    const resolvedArgs = normalizeArgsForSandbox(
      rawArgs,
      context.workspaceRoot,
    );
    const content = await catalogEntry.handler(context, ...resolvedArgs);

    return {
      role: "function",
      name,
      content,
    };
  };
};
