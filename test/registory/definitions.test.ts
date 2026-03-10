import { describe, expect, it } from "bun:test";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { TOOL_DEFINITIONS } from "../../src/registory/definitions";

const toToolArray = (
  definitions: typeof TOOL_DEFINITIONS,
): ChatCompletionTool[] => {
  return Object.values(definitions);
};

describe("TOOL_DEFINITIONS", () => {
  it("ChatCompletionTool[] として扱えること", () => {
    const tools = toToolArray(TOOL_DEFINITIONS);

    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((tool) => tool.type === "function")).toBe(true);
  });

  it("regexp_search の定義が仕様どおり登録されていること", () => {
    expect(TOOL_DEFINITIONS.regexp_search).toEqual({
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
              description:
                "Maximum number of matches to return (default: 100).",
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
    });
  });
});
