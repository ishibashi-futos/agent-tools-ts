import type { Tool } from "./types";

export const TOOL_DEFINITIONS = {
  git_status_summary: {
    type: "function",
    function: {
      name: "git_status_summary",
      description:
        "Returns current git branch and raw porcelain status output for a workspace directory.",
      parameters: {
        type: "object",
        properties: {
          cwd: {
            type: "string",
            default: ".",
            description:
              "Workspace path to inspect (default: workspace root). Accepts / or \\\\ as separator; escape backslash in JSON (e.g. src\\\\tools).",
          },
        },
        required: [],
      },
    },
  },
  apply_patch: {
    type: "function",
    function: {
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
  },
  write_file: {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Writes UTF-8 text to a file in the workspace. Use this for full content writes or creating new files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Workspace-root-relative file path to write.",
          },
          content: {
            type: "string",
            description: "Full UTF-8 file content to write.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  exec_command: {
    type: "function",
    function: {
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
  },
  tree: {
    type: "function",
    function: {
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
  },
  read_file: {
    type: "function",
    function: {
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
  },
  regexp_search: {
    type: "function",
    function: {
      name: "regexp_search",
      description:
        "Searches workspace text files with a regular expression and returns deterministic match locations.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Regular expression pattern source.",
          },
          flags: {
            type: "string",
            default: "",
            description: "Regex flags from g/i/m/s/u only (default: empty).",
          },
          root_path: {
            type: "string",
            default: ".",
            description:
              "Workspace-relative root directory (default: .). Accepts / or \\\\ and requires JSON escaping for backslashes.",
          },
          include: {
            type: "array",
            items: { type: "string" },
            description:
              "Glob allowlist patterns within searchable paths. Does not override exclusions.",
          },
          exclude: {
            type: "array",
            items: { type: "string" },
            description:
              "Glob denylist patterns (takes precedence over include).",
          },
          max_results: {
            type: "number",
            default: 100,
            description: "Maximum number of matches to return (default: 100).",
          },
          max_file_size_bytes: {
            type: "number",
            default: 1048576,
            enum: [1048576],
            description: "Per-file size limit in bytes (fixed: 1048576).",
          },
          timeout_ms: {
            type: "number",
            default: 5000,
            description: "Search timeout in milliseconds (default: 5000).",
          },
        },
        required: ["pattern"],
      },
    },
  },
} as const satisfies Record<string, Tool>;

export type AllowedToolName = keyof typeof TOOL_DEFINITIONS;
