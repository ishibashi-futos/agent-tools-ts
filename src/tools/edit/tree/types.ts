export type TreeEntryKind = "directory" | "all";

export type TreeInput = {
  path: string;
  entry_kind?: TreeEntryKind;
  max_depth?: number;
  max_entries?: number;
  include_hidden?: boolean;
  exclude?: string[];
};

export type TreeOptions = Omit<TreeInput, "path">;

export type TreeNode = {
  name: string;
  path: string;
  depth: number;
};

export type TreeDirectoryNode = TreeNode & {
  kind: "directory";
  truncated?: boolean;
  children?: TreeEntry[];
};

export type TreeFileNode = TreeNode & {
  kind: "file";
};

export type TreeSymlinkNode = TreeNode & {
  kind: "symlink";
};

export type TreeEntry = TreeDirectoryNode | TreeFileNode | TreeSymlinkNode;

export type TreeOutput = {
  root: TreeDirectoryNode;
  limit_reached: boolean;
  scanned_entries: number;
  total_dirs: number;
  total_files: number;
  total_symlinks: number;
};

export type TreeValidatedInput = {
  path: string;
  entry_kind: TreeEntryKind;
  max_depth: number;
  max_entries: number;
  include_hidden: boolean;
  exclude: string[];
};
