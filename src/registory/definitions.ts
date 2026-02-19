export const TOOL_DEFINITIONS = {
  apply_patch: {
    name: "apply_patch",
    description:
      "Applies a unified diff patch to a file. Best for making precise code changes.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Target file path" },
        patch: { type: "string", description: "Unified diff content" },
      },
      required: ["filePath", "patch"],
    },
  },
  exec_command: {
    name: "exec_command",
    description:
      "Runs a command once in the workspace and returns stdout, stderr, and exit code.",
    parameters: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description: "Working directory path in workspace.",
        },
        command: {
          type: "array",
          items: { type: "string" },
          description:
            "Only the target command tokens to run (e.g. bun run dev).",
        },
        shell_mode: {
          type: "string",
          enum: ["default", "direct"],
          default: "default",
          description:
            "Use default to apply OS shell wrapper automatically (default: default).",
        },
        stdin: {
          type: "string",
          description: "UTF-8 stdin text.",
        },
        timeout_ms: {
          type: "number",
          default: 30000,
          description: "Execution timeout in milliseconds (default: 30000).",
        },
        max_output_chars: {
          type: "number",
          default: 200000,
          description: "Per-stream output char limit (default: 200000).",
        },
      },
      required: ["cwd", "command"],
    },
  },
  tree: {
    name: "tree",
    description:
      "Returns a workspace tree: directories only or directories with files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path in workspace." },
        entry_kind: {
          type: "string",
          enum: ["directory", "all"],
          default: "directory",
          description: "Node types to include (default: directory).",
        },
        max_depth: {
          type: "number",
          default: 3,
          description: "Maximum traversal depth (default: 3).",
        },
        max_entries: {
          type: "number",
          default: 100,
          description: "Maximum node count (default: 100).",
        },
        include_hidden: {
          type: "boolean",
          default: false,
          description: "Include dot-prefixed entries (default: false).",
        },
        exclude: {
          type: "array",
          items: { type: "string" },
          description: "Glob patterns to exclude paths.",
        },
      },
      required: ["path"],
    },
  },
  read_file: {
    name: "read_file",
    description:
      "Reads a UTF-8 text file in the workspace and returns a line-limited content window.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            'Workspace-root-relative file path to read (e.g., "src/main.ts").',
        },
        start_line: {
          type: "number",
          default: 1,
          description:
            "1-based start line of the returned window (default: 1).",
        },
        max_lines: {
          type: "number",
          default: 200,
          description: "Maximum number of lines to return (default: 200).",
        },
      },
      required: ["path"],
    },
  },
};
