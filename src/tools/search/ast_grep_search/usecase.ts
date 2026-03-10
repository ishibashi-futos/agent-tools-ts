import { relative } from "node:path";
import { astGrepSearchAdapter } from "./adapter";
import type {
  AstGrepAdapterOutput,
  AstGrepJsonMatch,
  AstGrepSearchOutput,
  AstGrepSearchValidatedInput,
} from "./types";

type Dependencies = {
  search: (input: {
    workspace_root: string;
    root_path: string;
    language: string;
    rule: Record<string, unknown>;
    include: string[];
    exclude: string[];
    max_results: number;
    timeout_ms: number;
  }) => Promise<AstGrepAdapterOutput>;
  now: () => number;
};

const toWorkspaceRelativePath = (
  workspaceRoot: string,
  absolutePath: string,
): string => {
  const relativePath = relative(workspaceRoot, absolutePath).replace(
    /\\/g,
    "/",
  );
  return relativePath.length === 0 ? "." : relativePath;
};

const compareMatches = (
  left: AstGrepJsonMatch,
  right: AstGrepJsonMatch,
): number => {
  if (left.file !== right.file) {
    return left.file.localeCompare(right.file);
  }
  if (left.range.start.line !== right.range.start.line) {
    return left.range.start.line - right.range.start.line;
  }
  if (left.range.start.column !== right.range.start.column) {
    return left.range.start.column - right.range.start.column;
  }
  if (left.range.end.line !== right.range.end.line) {
    return left.range.end.line - right.range.end.line;
  }
  return left.range.end.column - right.range.end.column;
};

export const createAstGrepSearchUsecase = (
  deps: Dependencies = {
    search: astGrepSearchAdapter,
    now: () => Date.now(),
  },
) => {
  return async (
    workspaceRoot: string,
    input: AstGrepSearchValidatedInput,
  ): Promise<AstGrepSearchOutput> => {
    const startedAt = deps.now();
    const result = await deps.search({
      workspace_root: workspaceRoot,
      root_path: input.root_path,
      language: input.language,
      rule: input.rule,
      include: input.include,
      exclude: input.exclude,
      max_results: input.max_results,
      timeout_ms: input.timeout_ms,
    });

    const items = [...result.items].sort(compareMatches);

    return {
      query: {
        language: input.language,
        rule: input.rule,
      },
      root_path: toWorkspaceRelativePath(workspaceRoot, input.root_path),
      took_ms: Math.max(0, deps.now() - startedAt),
      truncated: result.truncated,
      items,
      warnings: result.warnings,
    };
  };
};

export const astGrepSearchUsecase = createAstGrepSearchUsecase();
