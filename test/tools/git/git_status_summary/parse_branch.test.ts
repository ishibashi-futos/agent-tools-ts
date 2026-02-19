import { describe, expect, it } from "bun:test";
import { parseBranchFromPorcelain } from "../../../../src/tools/git/git_status_summary/parse_branch";

describe("parse_branch", () => {
  it("branch 行からブランチ名を抽出できること", () => {
    const raw =
      "## feature/example...origin/feature/example [ahead 1]\n M src/lib.ts\n";

    expect(parseBranchFromPorcelain(raw)).toBe("feature/example");
  });

  it("detached HEAD の場合は null を返すこと", () => {
    const raw = "## HEAD (detached at 1234567)\n M src/lib.ts\n";

    expect(parseBranchFromPorcelain(raw)).toBeNull();
  });

  it("## 行が存在しない場合は null を返すこと", () => {
    const raw = " M src/lib.ts\n";

    expect(parseBranchFromPorcelain(raw)).toBeNull();
  });
});
