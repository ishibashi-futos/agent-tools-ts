const DEFAULT_EXCLUDED_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  ".vscode",
  ".DS_Store",
]);

type CompiledPatterns = {
  raw: string;
  glob: Bun.Glob;
};

export type TreeFilter = {
  shouldExclude: (relativePath: string, name: string) => boolean;
};

const hasBalancedToken = (
  pattern: string,
  openToken: string,
  closeToken: string,
): boolean => {
  let depth = 0;

  for (const char of pattern) {
    if (char === openToken) {
      depth += 1;
      continue;
    }

    if (char === closeToken) {
      if (depth === 0) {
        return false;
      }
      depth -= 1;
    }
  }

  return depth === 0;
};

const validatePattern = (pattern: string): void => {
  if (pattern.length === 0) {
    throw new Error("INVALID_ARGUMENT: exclude must not contain empty pattern");
  }

  if (pattern.includes("\0")) {
    throw new Error(
      "INVALID_ARGUMENT: exclude pattern must not contain null char",
    );
  }

  if (!hasBalancedToken(pattern, "[", "]")) {
    throw new Error(
      "INVALID_ARGUMENT: exclude pattern has unbalanced square brackets",
    );
  }

  if (!hasBalancedToken(pattern, "{", "}")) {
    throw new Error("INVALID_ARGUMENT: exclude pattern has unbalanced braces");
  }
};

const compilePatterns = (patterns: string[]): CompiledPatterns[] => {
  return patterns.map((rawPattern) => {
    validatePattern(rawPattern);

    return {
      raw: rawPattern,
      glob: new Bun.Glob(rawPattern),
    };
  });
};

const normalizePathForMatch = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  if (normalized === ".") {
    return "";
  }
  return normalized;
};

const isPatternMatched = (
  patterns: CompiledPatterns[],
  relativePath: string,
): boolean => {
  const normalized = normalizePathForMatch(relativePath);
  const candidateForDirectory = normalized.length > 0 ? `${normalized}/` : "";

  for (const pattern of patterns) {
    if (pattern.glob.match(normalized)) {
      return true;
    }
    if (
      candidateForDirectory.length > 0 &&
      pattern.glob.match(candidateForDirectory)
    ) {
      return true;
    }
  }

  return false;
};

export const createTreeFilter = (
  includeHidden: boolean,
  excludePatterns: string[],
): TreeFilter => {
  const compiledPatterns = compilePatterns(excludePatterns);

  return {
    shouldExclude: (relativePath: string, name: string): boolean => {
      if (!includeHidden && name.startsWith(".")) {
        return true;
      }

      if (DEFAULT_EXCLUDED_NAMES.has(name)) {
        return true;
      }

      return isPatternMatched(compiledPatterns, relativePath);
    },
  };
};
