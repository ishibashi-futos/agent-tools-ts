import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { treeUsecase } from "../../../../src/tools/edit/tree/usecase";
import type { TreeValidatedInput } from "../../../../src/tools/edit/tree/types";

const createTempDir = async (): Promise<string> => {
  return await mkdtemp(join(tmpdir(), "tree-usecase-"));
};

const createInput = (
  rootPath: string,
  overrides: Partial<TreeValidatedInput> = {},
): TreeValidatedInput => {
  return {
    path: rootPath,
    entry_kind: "all",
    max_depth: 3,
    max_entries: 100,
    include_hidden: true,
    exclude: [],
    ...overrides,
  };
};

describe("tree usecase", () => {
  it("ソート順が directory -> file -> symlink かつ名前昇順であること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "b-dir"), { recursive: true });
      await mkdir(join(workspaceRoot, "a-dir"), { recursive: true });
      await writeFile(join(workspaceRoot, "z-file.txt"), "z");
      await writeFile(join(workspaceRoot, "a-file.txt"), "a");

      try {
        await symlink(
          join(workspaceRoot, "a-dir"),
          join(workspaceRoot, "m-link"),
        );
      } catch {
        // 権限などでシンボリックリンクを作成できない環境では無視する
      }

      const result = await treeUsecase(
        workspaceRoot,
        createInput(workspaceRoot, { max_depth: 1 }),
      );

      const namesWithKind = (result.root.children ?? []).map(
        (entry) => `${entry.kind}:${entry.name}`,
      );

      const expectedHead = [
        "directory:a-dir",
        "directory:b-dir",
        "file:a-file.txt",
        "file:z-file.txt",
      ];

      expect(namesWithKind.slice(0, 4)).toEqual(expectedHead);
      if (namesWithKind.length >= 5) {
        expect(namesWithKind[4]?.startsWith("symlink:")).toBe(true);
      }
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("max_depth 到達時に truncated=true を付与すること", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "parent", "child", "grand"), {
        recursive: true,
      });

      const result = await treeUsecase(
        workspaceRoot,
        createInput(workspaceRoot, {
          entry_kind: "directory",
          max_depth: 1,
        }),
      );

      const parent = result.root.children?.[0];
      expect(parent?.kind).toBe("directory");
      if (parent?.kind !== "directory") {
        throw new Error("Expected directory node");
      }

      expect(parent.truncated).toBe(true);
      expect(parent.children).toBeUndefined();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("シンボリックリンクを展開せずノードのみ返すこと", async () => {
    const workspaceRoot = await createTempDir();

    try {
      await mkdir(join(workspaceRoot, "real", "deep"), { recursive: true });
      await writeFile(join(workspaceRoot, "real", "deep", "a.txt"), "a");

      let symlinkCreated = true;
      try {
        await symlink(
          join(workspaceRoot, "real"),
          join(workspaceRoot, "real-link"),
        );
      } catch {
        symlinkCreated = false;
      }

      const result = await treeUsecase(
        workspaceRoot,
        createInput(workspaceRoot),
      );

      const rootChildren = result.root.children ?? [];
      const linkNode = rootChildren.find((entry) => entry.name === "real-link");

      if (!symlinkCreated) {
        expect(linkNode).toBeUndefined();
        return;
      }

      expect(linkNode?.kind).toBe("symlink");
      expect(linkNode && "children" in linkNode).toBe(false);

      // symlink を辿らないため、real/deep/a.txt のみがファイルとして集計される
      expect(result.total_files).toBe(1);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
