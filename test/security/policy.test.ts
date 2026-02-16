// test/security/policy.test.ts
import { describe, it, expect } from "bun:test";
import {
  SecurityPolicy,
  type SecurityPolicyConfig,
} from "../../src/security/policy.ts";

const config: SecurityPolicyConfig = {
  tools: { git_log: "allow", rm_rf: "deny" },
  defaultPolicy: "deny" as const,
};

describe("SecurityPolicy", () => {
  it("should allow whitelisted tools", () => {
    expect(() => SecurityPolicy.authorize("git_log", config)).not.toThrow();
  });

  it("should deny blacklisted tools", () => {
    expect(() => SecurityPolicy.authorize("rm_rf", config)).toThrow();
  });

  it("should bypass check when wrapped in runWithBypass", () => {
    SecurityPolicy.runWithBypass(() => {
      expect(() => SecurityPolicy.authorize("rm_rf", config)).not.toThrow();
    });
  });
});
