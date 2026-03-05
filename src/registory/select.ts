import type { SecurityPolicyConfig } from "../security/policy";
import type { Tool } from "./types";

/**
 * ポリシー設定に従って、許可されているツールのみを定義順で返す。
 */
export function selectAllowedTools<TDefinitions extends Record<string, Tool>>(
  definitions: TDefinitions,
  policy: SecurityPolicyConfig<Extract<keyof TDefinitions, string>>,
): Array<TDefinitions[keyof TDefinitions]> {
  const result: Array<TDefinitions[keyof TDefinitions]> = [];

  for (const toolName of Object.keys(definitions) as Array<
    Extract<keyof TDefinitions, string>
  >) {
    const tool = definitions[toolName];
    const access = policy.tools[toolName] ?? policy.defaultPolicy;
    if (access === "allow") {
      result.push(tool);
    }
  }

  return result;
}
