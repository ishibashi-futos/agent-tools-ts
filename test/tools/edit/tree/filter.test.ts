import { describe, expect, it } from "bun:test";
import { createTreeFilter } from "../../../../src/tools/edit/tree/filter";

describe("tree filter", () => {
  it("include_hidden=false のときドット始まりを除外すること", () => {
    const filter = createTreeFilter(false, []);

    expect(filter.shouldExclude("src/.cache", ".cache")).toBe(true);
    expect(filter.shouldExclude("src/main.ts", "main.ts")).toBe(false);
  });

  it("デフォルト除外名を常に除外すること", () => {
    const filter = createTreeFilter(true, []);

    expect(filter.shouldExclude(".git", ".git")).toBe(true);
    expect(filter.shouldExclude("node_modules", "node_modules")).toBe(true);
    expect(filter.shouldExclude("dist", "dist")).toBe(true);
  });

  it("exclude glob に一致するパスを除外すること", () => {
    const filter = createTreeFilter(true, ["**/*.log", "**/logs/**"]);

    expect(filter.shouldExclude("app/error.log", "error.log")).toBe(true);
    expect(filter.shouldExclude("src/logs", "logs")).toBe(true);
    expect(filter.shouldExclude("src/main.ts", "main.ts")).toBe(false);
  });

  it("exclude に不正パターンが含まれると INVALID_ARGUMENT を投げること", () => {
    expect(() => createTreeFilter(true, ["[abc"])).toThrow(
      "INVALID_ARGUMENT: exclude pattern has unbalanced square brackets",
    );
    expect(() => createTreeFilter(true, [""])).toThrow(
      "INVALID_ARGUMENT: exclude must not contain empty pattern",
    );
  });
});
