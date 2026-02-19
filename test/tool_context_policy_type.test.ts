import { describe, expect, it } from "bun:test";
import { createToolContext, type ToolContext } from "../src/lib";

// 型検証専用: TOOL_DEFINITIONS のキーのみ policy.tools に指定できることを保証する
function typeAssertions(): void {
  createToolContext({
    workspaceRoot: ".",
    policy: {
      tools: {
        read_file: "allow",
        exec_command: "deny",
      },
      defaultPolicy: "deny",
    },
  });

  createToolContext({
    workspaceRoot: ".",
    policy: {
      tools: {
        // @ts-expect-error typo した tool 名は受け付けない
        read_flie: "allow",
      },
      defaultPolicy: "deny",
    },
  });
}

describe("ToolContext policy type", () => {
  it("ToolContext の policy.tools が tool 名で型付けされること", () => {
    const context: ToolContext = createToolContext({
      workspaceRoot: ".",
      policy: {
        tools: { read_file: "allow" },
        defaultPolicy: "deny",
      },
    });

    expect(context.policy.tools.read_file).toBe("allow");
    expect(typeAssertions).toBeDefined();
  });
});
