import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import type {
  AstGrepJsonMatch,
  AstGrepSearchValidatedInput,
} from "../../../../src/tools/search/ast_grep_search/types";
import { createAstGrepSearchUsecase } from "../../../../src/tools/search/ast_grep_search/usecase";

const createInput = (
  rootPath: string,
  overrides: Partial<AstGrepSearchValidatedInput> = {},
): AstGrepSearchValidatedInput => {
  return {
    language: "typescript",
    rule: { pattern: "const $A = $B" },
    root_path: rootPath,
    include: [],
    exclude: [],
    max_results: 100,
    timeout_ms: 5_000,
    ...overrides,
  };
};

const createMatch = (
  file: string,
  startLine: number,
  startColumn: number,
  endLine = startLine,
  endColumn = startColumn + 1,
): AstGrepJsonMatch => {
  return {
    text: "match",
    file,
    range: {
      start: { line: startLine, column: startColumn },
      end: { line: endLine, column: endColumn },
    },
  };
};

describe("ast_grep_search usecase", () => {
  it("file/range の安定ソートで返すこと", async () => {
    const usecase = createAstGrepSearchUsecase({
      search: async () => ({
        items: [
          createMatch("src/b.ts", 0, 1),
          createMatch("src/a.ts", 1, 0),
          createMatch("src/a.ts", 0, 3),
        ],
        truncated: false,
        warnings: [],
      }),
      now: () => 10,
    });

    const result = await usecase(
      "/workspace",
      createInput("/workspace", {
        rule: { pattern: "TODO" },
      }),
    );

    expect(
      result.items.map(
        (item) =>
          `${item.file}:${item.range.start.line}:${item.range.start.column}`,
      ),
    ).toEqual(["src/a.ts:0:3", "src/a.ts:1:0", "src/b.ts:0:1"]);
  });

  it("root_path を workspace 相対にして warnings を維持すること", async () => {
    let now = 0;
    const usecase = createAstGrepSearchUsecase({
      search: async () => ({
        items: [createMatch("src/main.ts", 0, 0)],
        truncated: true,
        warnings: ["inspected_with_sg"],
      }),
      now: () => {
        now += 5;
        return now;
      },
    });

    const result = await usecase(
      "/workspace",
      createInput(resolve("/workspace", "src")),
    );

    expect(result.root_path).toBe("src");
    expect(result.truncated).toBe(true);
    expect(result.warnings).toEqual(["inspected_with_sg"]);
    expect(result.took_ms).toBe(5);
  });
});
