const NO_COMMITS_YET_PREFIX = "No commits yet on ";
const INITIAL_COMMIT_PREFIX = "Initial commit on ";

const parseFromBranchHeader = (header: string): string | null => {
  if (header.length === 0) {
    return null;
  }

  if (header === "HEAD" || header.startsWith("HEAD ")) {
    return null;
  }

  if (header.startsWith(NO_COMMITS_YET_PREFIX)) {
    const branch = header.slice(NO_COMMITS_YET_PREFIX.length).trim();
    return branch.length > 0 ? branch : null;
  }

  if (header.startsWith(INITIAL_COMMIT_PREFIX)) {
    const branch = header.slice(INITIAL_COMMIT_PREFIX.length).trim();
    return branch.length > 0 ? branch : null;
  }

  const branch = header.split("...")[0]?.trim() ?? "";
  if (branch.length === 0 || branch === "HEAD" || branch.startsWith("HEAD ")) {
    return null;
  }

  return branch;
};

export const parseBranchFromPorcelain = (raw: string): string | null => {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.startsWith("##")) {
    return null;
  }

  const header = firstLine.slice(2).trim();
  return parseFromBranchHeader(header);
};
