import {
  type SpawnOptions,
  type SpawnResult,
  spawn,
} from "../../../utils/exec";
import { resolveExecutionCommand } from "./resolve_command";
import type { ExecCommandOutput, ExecCommandValidatedInput } from "./types";

export type ExecCommandUsecaseInput = ExecCommandValidatedInput & {
  platform: NodeJS.Platform;
};

type Dependencies = {
  spawn: (cmd: string[], options?: SpawnOptions) => Promise<SpawnResult>;
  resolveExecutionCommand: typeof resolveExecutionCommand;
};

export const createExecCommandUsecase = (
  deps: Dependencies = {
    spawn,
    resolveExecutionCommand,
  },
) => {
  return async (input: ExecCommandUsecaseInput): Promise<ExecCommandOutput> => {
    const startedAt = Date.now();

    const resolved = await deps.resolveExecutionCommand({
      cwd: input.cwd,
      command: input.command,
      shellMode: input.shell_mode,
      platform: input.platform,
    });

    const result = await deps.spawn(resolved.executable, {
      cwd: input.cwd,
      stdin: input.stdin,
      timeoutMs: input.timeout_ms,
      maxOutputChars: input.max_output_chars,
      env: process.env,
      platform: input.platform,
    });

    return {
      cwd: input.cwd,
      command: input.command,
      exit_code: result.timedOut ? 124 : result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      stdout_truncated: result.stdoutTruncated,
      stderr_truncated: result.stderrTruncated,
      timed_out: result.timedOut,
      duration_ms: result.durationMs ?? Date.now() - startedAt,
    };
  };
};

export const execCommandUsecase = createExecCommandUsecase();
