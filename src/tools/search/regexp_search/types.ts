export type RegexpSearchErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_REGEX"
  | "NOT_FOUND"
  | "NOT_DIRECTORY"
  | "TIMEOUT"
  | "INTERNAL";

export type RegexpSearchInput = {
  pattern: string;
  flags?: string;
  root_path?: string;
  include?: string[];
  exclude?: string[];
  max_results?: number;
  max_file_size_bytes?: 1048576;
  timeout_ms?: number;
};

export type RegexpSearchValidatedInput = {
  pattern: string;
  flags: string;
  root_path: string;
  include: string[];
  exclude: string[];
  max_results: number;
  max_file_size_bytes: 1048576;
  timeout_ms: number;
};

export type RegexpSearchItem = {
  path: string;
  line: number;
  column: number;
  match: string;
  line_text: string;
};

export type RegexpSearchOutput = {
  query: {
    pattern: string;
    flags: string;
  };
  root_path: string;
  took_ms: number;
  truncated: boolean;
  scanned_files: number;
  items: RegexpSearchItem[];
  warnings: string[];
};
