const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  ".vscode",
]);

type CompiledPattern = {
  glob: Bun.Glob;
};

export type RegexpSearchPathFilter = {
  shouldTraverseDirectory: (relativePath: string, name: string) => boolean;
  shouldIncludeFile: (relativePath: string) => boolean;
};

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  if (normalized === "." || normalized.length === 0) {
    return "";
  }
  return normalized
    .replace(/\/+/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/$/, "");
};

const compilePatterns = (patterns: string[]): CompiledPattern[] => {
  return patterns.map((pattern) => ({
    glob: new Bun.Glob(pattern),
  }));
};

const matchesGlob = (
  patterns: CompiledPattern[],
  relativePath: string,
  isDirectory: boolean,
): boolean => {
  const normalized = normalizePath(relativePath);
  const directoryCandidate =
    isDirectory && normalized.length > 0 ? `${normalized}/` : normalized;

  for (const pattern of patterns) {
    if (pattern.glob.match(normalized)) {
      return true;
    }
    if (
      directoryCandidate.length > 0 &&
      pattern.glob.match(directoryCandidate)
    ) {
      return true;
    }
  }

  return false;
};

export const createRegexpSearchPathFilter = (
  includePatterns: string[],
  excludePatterns: string[],
): RegexpSearchPathFilter => {
  const compiledIncludePatterns = compilePatterns(includePatterns);
  const compiledExcludePatterns = compilePatterns(excludePatterns);

  const isDefaultExcludedDirectory = (name: string): boolean => {
    return DEFAULT_EXCLUDED_DIRECTORY_NAMES.has(name);
  };

  const isExplicitlyExcluded = (relativePath: string): boolean => {
    return matchesGlob(compiledExcludePatterns, relativePath, true);
  };

  return {
    shouldTraverseDirectory: (relativePath: string, name: string): boolean => {
      if (isDefaultExcludedDirectory(name)) {
        return false;
      }
      if (isExplicitlyExcluded(relativePath)) {
        return false;
      }
      return true;
    },
    shouldIncludeFile: (relativePath: string): boolean => {
      if (isExplicitlyExcluded(relativePath)) {
        return false;
      }
      if (compiledIncludePatterns.length === 0) {
        return true;
      }
      return matchesGlob(compiledIncludePatterns, relativePath, false);
    },
  };
};
