export type ExecCommandShellMode = "default" | "direct";

export type ExecCommandOptions = {
  shell_mode?: ExecCommandShellMode;
  stdin?: string;
  timeout_ms?: number;
  max_output_chars?: number;
};

export type ExecCommandInput = {
  cwd: string;
  command: string[];
  shell_mode: ExecCommandShellMode;
  stdin?: string;
  timeout_ms: number;
  max_output_chars: number;
};

export type ExecCommandOutput = {
  cwd: string;
  command: string[];
  exit_code: number;
  stdout: string;
  stderr: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  timed_out: boolean;
  duration_ms: number;
};

export type ExecCommandErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_DIRECTORY"
  | "COMMAND_NOT_FOUND"
  | "INTERNAL";
