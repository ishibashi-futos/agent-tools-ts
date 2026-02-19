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
};
