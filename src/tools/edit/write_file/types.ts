export type WriteFileErrorCode = "INVALID_ARGUMENT" | "NOT_FILE" | "INTERNAL";

export type WriteFileInput = {
  path: string;
  content: string;
};

export type WriteFileOutput = {
  path: string;
  created: boolean;
  bytes_written: number;
};
