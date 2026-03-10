export type AstGrepSearchErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "NOT_DIRECTORY"
  | "INVALID_RULE"
  | "UNSUPPORTED_LANGUAGE"
  | "DEPENDENCY_MISSING"
  | "TIMEOUT"
  | "INTERNAL";

export type AstGrepSearchInput = {
  language: string;
  rule: Record<string, unknown>;
  root_path?: string;
  include?: string[];
  exclude?: string[];
  max_results?: number;
  timeout_ms?: number;
};

export type AstGrepSearchValidatedInput = {
  language: string;
  rule: Record<string, unknown>;
  root_path: string;
  include: string[];
  exclude: string[];
  max_results: number;
  timeout_ms: number;
};

export type AstGrepJsonPosition = {
  line: number;
  column: number;
  offset?: number;
  [key: string]: unknown;
};

export type AstGrepJsonRange = {
  start: AstGrepJsonPosition;
  end: AstGrepJsonPosition;
  [key: string]: unknown;
};

export type AstGrepJsonMatch = {
  text: string;
  file: string;
  range: AstGrepJsonRange;
  lines?: string;
  language?: string;
  metaVariables?: Record<string, unknown>;
  ruleId?: string;
  severity?: string;
  message?: string;
  note?: string | null;
  [key: string]: unknown;
};

export type AstGrepSearchOutput = {
  query: {
    language: string;
    rule: Record<string, unknown>;
  };
  root_path: string;
  took_ms: number;
  truncated: boolean;
  items: AstGrepJsonMatch[];
  warnings: string[];
};

export type AstGrepAdapterInput = {
  workspace_root: string;
  root_path: string;
  language: string;
  rule: Record<string, unknown>;
  include: string[];
  exclude: string[];
  max_results: number;
  timeout_ms: number;
};

export type AstGrepAdapterOutput = {
  items: AstGrepJsonMatch[];
  truncated: boolean;
  warnings: string[];
};
