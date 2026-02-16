import { describe, it, expect } from "bun:test";
import { SandboxFS } from "../../src/sandbox/fs";

describe("SandboxFS", () => {
  it("read-onlyモード: 読み取り操作は許可されること", () => {
    expect(() => SandboxFS.validateAccess("read-only", false)).not.toThrow();
  });

  it("read-onlyモード: 書き込み操作は拒否されること", () => {
    expect(() => SandboxFS.validateAccess("read-only", true))
      .toThrow(/Write operation denied/);
  });

  it("workspace-writeモード: 書き込み操作が許可されること", () => {
    expect(() => SandboxFS.validateAccess("workspace-write", true)).not.toThrow();
  });

  it("unrestrictedモード: すべての操作が許可されること", () => {
    expect(() => SandboxFS.validateAccess("unrestricted", true)).not.toThrow();
    expect(() => SandboxFS.validateAccess("unrestricted", false)).not.toThrow();
  });
});
