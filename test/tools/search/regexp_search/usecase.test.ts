import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { RegexpSearchError } from "../../../../src/tools/search/regexp_search/error";
import type { RegexpSearchValidatedInput } from "../../../../src/tools/search/regexp_search/types";
import {
  createRegexpSearchUsecase,
  regexpSearchUsecase,
} from "../../../../src/tools/search/regexp_search/usecase";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "regexp-search-usecase-"));
};

const createInput = (
  rootPath: string,
  overrides: Partial<RegexpSearchValidatedInput> = {},
): RegexpSearchValidatedInput => {
  return {
    pattern: "TODO",
    flags: "",
    root_path: rootPath,
    include: [],
    exclude: [],
    max_results: 100,
    max_file_size_bytes: 1_048_576,
    timeout_ms: 5_000,
    ...overrides,
  };
};

describe("regexp_search usecase", () => {
  it("path/line/column の安定ソートで返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await writeFile(join(workspaceRoot, "src", "b.ts"), "TODO\n");
      await writeFile(join(workspaceRoot, "src", "a.ts"), "TODO TODO\n");

      const result = await regexpSearchUsecase(
        workspaceRoot,
        createInput(workspaceRoot),
      );

      expect(
        result.items.map((item) => `${item.path}:${item.line}:${item.column}`),
      ).toEqual(["src/a.ts:1:1", "src/a.ts:1:6", "src/b.ts:1:1"]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("include は探索可能な通常ディレクトリの絞り込みとして動作すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await mkdir(join(workspaceRoot, "docs"), { recursive: true });
      await writeFile(join(workspaceRoot, "src", "main.ts"), "TODO\n");
      await writeFile(join(workspaceRoot, "docs", "guide.md"), "TODO\n");

      const result = await regexpSearchUsecase(
        workspaceRoot,
        createInput(workspaceRoot, {
          include: ["src/**"],
        }),
      );

      expect(result.items.map((item) => item.path)).toEqual(["src/main.ts"]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("include では既定除外ディレクトリを再度開けないこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "dist"), { recursive: true });
      await writeFile(join(workspaceRoot, "dist", "generated.ts"), "TODO\n");
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await writeFile(join(workspaceRoot, "src", "main.ts"), "TODO\n");

      const result = await regexpSearchUsecase(
        workspaceRoot,
        createInput(workspaceRoot, {
          include: ["dist/**", "src/**"],
        }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.path).toBe("src/main.ts");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("exclude は include より優先すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src", "generated"), {
        recursive: true,
      });
      await writeFile(join(workspaceRoot, "src", "main.ts"), "TODO\n");
      await writeFile(
        join(workspaceRoot, "src", "generated", "schema.ts"),
        "TODO\n",
      );

      const result = await regexpSearchUsecase(
        workspaceRoot,
        createInput(workspaceRoot, {
          include: ["src/**"],
          exclude: ["src/generated/**"],
        }),
      );

      expect(result.items.map((item) => item.path)).toEqual(["src/main.ts"]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("バイナリとサイズ超過を warning に集約すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await writeFile(
        join(workspaceRoot, "src", "binary.bin"),
        Buffer.from([0, 1, 2, 3]),
      );
      await writeFile(join(workspaceRoot, "src", "large.txt"), "x".repeat(10));
      await writeFile(join(workspaceRoot, "src", "main.ts"), "TODO\n");

      const result = await regexpSearchUsecase(
        workspaceRoot,
        createInput(resolve(workspaceRoot, "src"), {
          max_file_size_bytes: 5 as 1_048_576,
        }),
      );

      expect(result.warnings).toEqual([
        "skipped_binary_files=1",
        "skipped_size_limit_files=1",
      ]);
      expect(result.items).toHaveLength(1);
      expect(result.root_path).toBe("src");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("timeout 時は部分結果を返さず TIMEOUT を投げること", async () => {
    let now = 0;
    const usecase = createRegexpSearchUsecase({
      stat: async () => ({
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
      }),
      readdir: async () => {
        now += 2;
        return [];
      },
      readFile: async () => new Uint8Array(),
      now: () => now,
    });

    await expect(
      usecase("/workspace", createInput("/workspace", { timeout_ms: 1 })),
    ).rejects.toBeInstanceOf(RegexpSearchError);

    try {
      await usecase("/workspace", createInput("/workspace", { timeout_ms: 1 }));
      throw new Error("Expected timeout");
    } catch (error) {
      expect(error).toBeInstanceOf(RegexpSearchError);
      expect((error as RegexpSearchError).code).toBe("TIMEOUT");
    }
  });
});
