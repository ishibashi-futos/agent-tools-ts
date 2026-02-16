import { describe, it, expect } from "bun:test";
import { SandboxPath } from "../../src/sandbox/path";
import { resolve, sep } from "node:path";

describe("SandboxPath", () => {
  const root = resolve("/workspace/project");

  it("正常系: ワークスペース内のパスが絶対パスで返されること", () => {
    const target = "src/main.ts";
    const result = SandboxPath.resolveInWorkspace(target, root);
    expect(result).toBe(resolve(root, target));
  });

  it("異常系: 親ディレクトリへのトラバーサルをブロックすること", () => {
    const malicious = "../../../etc/passwd";
    expect(() => SandboxPath.resolveInWorkspace(malicious, root))
      .toThrow(/outside of workspace/);
  });

  it("異常系: ルート以外の絶対パス指定をブロックすること", () => {
    // Windowsなら C:\Windows, Unixなら /etc/shadow などを想定
    const absoluteMalicious = resolve("/etc/shadow");
    expect(() => SandboxPath.resolveInWorkspace(absoluteMalicious, root))
      .toThrow(/outside of workspace/);
  });

  it("境界値: ワークスペースのルートそのものは許可されること", () => {
    const result = SandboxPath.resolveInWorkspace(".", root);
    expect(result).toBe(root);
  });

  it("isSafe: 安全なパスと危険なパスを正しく判定すること", () => {
    expect(SandboxPath.isSafe("valid/path.ts", root)).toBe(true);
    expect(SandboxPath.isSafe("/hidden/danger", root)).toBe(false);
  });
});