import { describe, expect, it } from "bun:test";
import { TOOL_DEFINITIONS } from "../../src/registory/definitions";
import { selectAllowedTools } from "../../src/registory/select";
import type { SecurityPolicyConfig } from "../../src/security/policy";

describe("selectAllowedTools", () => {
  it("defaultPolicy=deny の場合は allow 指定ツールのみ返すこと", () => {
    const policy: SecurityPolicyConfig = {
      tools: { read_file: "allow", exec_command: "allow" },
      defaultPolicy: "deny",
    };

    const tools = selectAllowedTools(TOOL_DEFINITIONS, policy);
    const names = tools.map((tool) => tool.function.name);

    expect(names).toEqual(["exec_command", "read_file"]);
  });

  it("defaultPolicy=allow の場合は deny 指定ツールを除外すること", () => {
    const policy: SecurityPolicyConfig = {
      tools: { exec_command: "deny" },
      defaultPolicy: "allow",
    };

    const tools = selectAllowedTools(TOOL_DEFINITIONS, policy);
    const names = tools.map((tool) => tool.function.name);

    expect(names).not.toContain("exec_command");
    expect(names).toContain("apply_patch");
    expect(names).toContain("git_status_summary");
  });

  it("policy に未知キーがあっても無視して定義順を維持すること", () => {
    const policy: SecurityPolicyConfig = {
      tools: { unknown_tool: "allow", tree: "allow" },
      defaultPolicy: "deny",
    };

    const tools = selectAllowedTools(TOOL_DEFINITIONS, policy);
    const names = tools.map((tool) => tool.function.name);

    expect(names).toEqual(["tree"]);
  });
});
