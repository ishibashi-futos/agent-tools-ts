export type ReadFileErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "NOT_FILE"
  | "BINARY_NOT_SUPPORTED"
  | "SIZE_LIMIT_EXCEEDED"
  | "INTERNAL";

export type ReadFileInput = {
  path: string;
  start_line?: number;
  max_lines?: number;
};

export type ReadFileOptions = Omit<ReadFileInput, "path">;

export type ReadFileValidatedInput = {
  path: string;
  start_line: number;
  max_lines: number;
};

export type ReadFileOutput = {
  path: string;
  content: string;
  truncated: boolean;
  next_start_line: number | null;
  meta: {
    byte_length: number;
    line_count: number;
    returned_line_count: number;
    mtime_ms: number;
  };
};
