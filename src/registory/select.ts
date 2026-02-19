import type { SecurityPolicyConfig } from "../security/policy";
import type { Tool } from "./types";

/**
 * ポリシー設定に従って、許可されているツールのみを定義順で返す。
 */
export function selectAllowedTools(
  definitions: Record<string, Tool>,
  policy: SecurityPolicyConfig,
): Tool[] {
  const result: Tool[] = [];

  for (const [toolName, tool] of Object.entries(definitions)) {
    const access = policy.tools[toolName] ?? policy.defaultPolicy;
    if (access === "allow") {
      result.push(tool);
    }
  }

  return result;
}
