export const TOOL_DEFINITIONS = {
  apply_patch: {
    name: "apply_patch",
    description: "Applies a unified diff patch to a file. Best for making precise code changes.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Target file path" },
        patch: { type: "string", description: "Unified diff content" }
      },
      required: ["filePath", "patch"]
    }
  }
};