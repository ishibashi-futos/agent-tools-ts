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
});
