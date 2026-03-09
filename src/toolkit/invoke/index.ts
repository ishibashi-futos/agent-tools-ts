import type { ToolContext } from "../../factory";
import type { AllowedToolName } from "../../registory/definitions";
import { SandboxFS } from "../../sandbox/fs";
import { SandboxPath } from "../../sandbox/path";
import { SecurityPolicy } from "../../security/policy";
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
  WriteFileInput,
  WriteFileOutput,
} from "../../tools/edit/write_file/types";
import type {
  ExecCommandInput,
  ExecCommandOutput,
} from "../../tools/exec/exec_command/types";
import type {
  GitStatusSummaryInput,
  GitStatusSummaryOutput,
} from "../../tools/git/git_status_summary/types";
import type {
  TaskCreateManyInput,
  TaskCreateManyOutput,
  TaskListInput,
  TaskListOutput,
  TaskUpdateInput,
  TaskUpdateOutput,
  TaskUpdateStatusInput,
  TaskUpdateStatusOutput,
  TaskValidateCompletionInput,
  TaskValidateCompletionOutput,
} from "../../tools/todo/types";
import { InvokeToolError } from "./error";

export interface ToolArgsByName extends Record<AllowedToolName, unknown> {
  apply_patch: ApplyPatchInput;
  write_file: WriteFileInput;
  exec_command: ExecCommandInput;
  tree: TreeInput;
  read_file: ReadFileInput;
  git_status_summary: GitStatusSummaryInput;
  task_create_many: TaskCreateManyInput;
  task_list: TaskListInput;
  task_update: TaskUpdateInput;
  task_update_status: TaskUpdateStatusInput;
  task_validate_completion: TaskValidateCompletionInput;
}

export interface ToolResultByName extends Record<AllowedToolName, unknown> {
  apply_patch: ApplyPatchOutput;
  write_file: WriteFileOutput;
  exec_command: ExecCommandOutput;
  tree: TreeOutput;
  read_file: ReadFileOutput;
  git_status_summary: GitStatusSummaryOutput;
  task_create_many: TaskCreateManyOutput;
  task_list: TaskListOutput;
  task_update: TaskUpdateOutput;
  task_update_status: TaskUpdateStatusOutput;
  task_validate_completion: TaskValidateCompletionOutput;
}

type ToolInvocationArgsByName = {
  apply_patch: [filePath: string, patch: string];
  write_file: [path: string, content: string];
  exec_command: [input: ExecCommandInput];
  tree: [
    path: string,
    options: {
      entry_kind?: TreeInput["entry_kind"];
      max_depth?: TreeInput["max_depth"];
      max_entries?: TreeInput["max_entries"];
      include_hidden?: TreeInput["include_hidden"];
      exclude?: TreeInput["exclude"];
    },
  ];
  read_file: [
    path: string,
    options: {
      start_line?: ReadFileInput["start_line"];
      max_lines?: ReadFileInput["max_lines"];
    },
  ];
  git_status_summary: [cwd: string | undefined];
  task_create_many: [input: TaskCreateManyInput];
  task_list: [input: TaskListInput];
  task_update: [input: TaskUpdateInput];
  task_update_status: [input: TaskUpdateStatusInput];
  task_validate_completion: [input: TaskValidateCompletionInput];
};

export type ToolkitInvokeOutput<TName extends AllowedToolName> = {
  role: "function";
  name: TName;
  content: ToolResultByName[TName];
};

export type Invoke = <TName extends AllowedToolName>(
  name: TName,
  args: ToolArgsByName[TName],
) => Promise<ToolkitInvokeOutput<TName>>;

type CatalogEntry<TName extends AllowedToolName> = {
  metadata: {
    name: TName;
    isWriteOp: boolean;
  };
  handler: (
    context: ToolContext<AllowedToolName>,
    ...args: ToolInvocationArgsByName[TName]
  ) => Promise<ToolResultByName[TName]> | ToolResultByName[TName];
};

type InvokeCatalog = { [TName in AllowedToolName]: CatalogEntry<TName> };

type ToolArgumentResolver = {
  [TName in AllowedToolName]: (
    args: ToolArgsByName[TName],
  ) => ToolInvocationArgsByName[TName];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const TOOL_ARGUMENT_RESOLVERS: ToolArgumentResolver = {
  apply_patch: (args) => [args.filePath, args.patch],
  write_file: (args) => [args.path, args.content],
  exec_command: (args) => [args],
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
  task_create_many: (args) => [args],
  task_list: (args) => [args],
  task_update: (args) => [args],
  task_update_status: (args) => [args],
  task_validate_completion: (args) => [args],
};

const normalizeArgsForSandbox = <TName extends AllowedToolName>(
  toolName: TName,
  args: ToolInvocationArgsByName[TName],
  workspaceRoot: string,
): ToolInvocationArgsByName[TName] => {
  if (
    toolName === "exec_command" &&
    typeof args[0] === "object" &&
    args[0] !== null &&
    !Array.isArray(args[0])
  ) {
    const input = args[0] as Record<string, unknown>;
    if (typeof input.cwd === "string") {
      const normalizedCwd = input.cwd.replace(/\\/g, "/");
      const resolved = SandboxPath.resolveInWorkspace(
        normalizedCwd,
        workspaceRoot,
      );
      return [{ ...input, cwd: resolved }] as ToolInvocationArgsByName[TName];
    }
    return args;
  }

  if (typeof args[0] !== "string") {
    return args;
  }

  const normalizedPathArg = args[0].replace(/\\/g, "/");
  const resolved = SandboxPath.resolveInWorkspace(
    normalizedPathArg,
    workspaceRoot,
  );
  if (toolName === "apply_patch") {
    return [resolved, args[1] as string] as ToolInvocationArgsByName[TName];
  }
  if (toolName === "write_file") {
    return [resolved, args[1] as string] as ToolInvocationArgsByName[TName];
  }
  if (toolName === "tree") {
    return [
      resolved,
      args[1] as ToolInvocationArgsByName["tree"][1],
    ] as ToolInvocationArgsByName[TName];
  }
  if (toolName === "read_file") {
    return [
      resolved,
      args[1] as ToolInvocationArgsByName["read_file"][1],
    ] as ToolInvocationArgsByName[TName];
  }
  if (toolName === "git_status_summary") {
    return [resolved] as ToolInvocationArgsByName[TName];
  }
  return args;
};

type InvokeParams = {
  context: ToolContext<AllowedToolName>;
  catalog: InvokeCatalog;
};

export const createInvoke = ({ context, catalog }: InvokeParams): Invoke => {
  return async <TName extends AllowedToolName>(
    name: TName,
    args: ToolArgsByName[TName],
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

    try {
      SandboxFS.validateAccess(
        context.writeScope,
        catalogEntry.metadata.isWriteOp,
      );
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
    const rawArgs = TOOL_ARGUMENT_RESOLVERS[name](args);
    const resolvedArgs = normalizeArgsForSandbox(
      name,
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
