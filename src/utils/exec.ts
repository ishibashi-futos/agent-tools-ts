const KILL_GRACE_MS = 500;

export type SpawnOptions = {
  stdin?: string | Uint8Array;
  cwd?: string;
  timeoutMs?: number;
  maxOutputChars?: number;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
};

export type SpawnResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  durationMs: number;
};

type CapturedOutput = {
  output: string;
  truncated: boolean;
};

const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const captureStream = async (
  stream: ReadableStream<Uint8Array> | null,
  maxOutputChars: number,
): Promise<CapturedOutput> => {
  if (!stream) {
    return { output: "", truncated: false };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let output = "";
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });

    if (!truncated) {
      const remaining = maxOutputChars - output.length;
      if (remaining > 0) {
        output += chunk.slice(0, remaining);
      }
      if (chunk.length > remaining) {
        truncated = true;
      }
    }
  }

  const tail = decoder.decode();
  if (!truncated && tail.length > 0) {
    const remaining = maxOutputChars - output.length;
    if (remaining > 0) {
      output += tail.slice(0, remaining);
    }
    if (tail.length > remaining) {
      truncated = true;
    }
  }

  return {
    output,
    truncated,
  };
};

const tryKillProcessTreeOnWindows = async (pid: number): Promise<void> => {
  try {
    const taskkill = Bun.spawn(["taskkill", "/T", "/F", "/PID", String(pid)], {
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });
    await taskkill.exited;
  } catch {
    // taskkill が利用できない場合は呼び出し元でフォールバックする
  }
};

const terminateProcess = async (
  proc: Bun.Subprocess,
  platform: NodeJS.Platform,
): Promise<void> => {
  if (platform === "win32") {
    if (typeof proc.pid === "number" && proc.pid > 0) {
      await tryKillProcessTreeOnWindows(proc.pid);
      return;
    }
  }

  try {
    proc.kill("SIGTERM");
  } catch {
    return;
  }

  const exitedWithinGrace = await Promise.race([
    proc.exited.then(() => true),
    wait(KILL_GRACE_MS).then(() => false),
  ]);

  if (!exitedWithinGrace) {
    try {
      proc.kill("SIGKILL");
    } catch {
      // すでに終了している場合は何もしない
    }
  }
};

export const spawn = async (
  cmd: string[],
  opts: SpawnOptions = {},
): Promise<SpawnResult> => {
  const stdinBuffer =
    typeof opts.stdin === "string"
      ? new TextEncoder().encode(opts.stdin)
      : opts.stdin;

  const maxOutputChars = opts.maxOutputChars ?? 200_000;
  const timeoutMs = opts.timeoutMs;
  const platform = opts.platform ?? process.platform;

  const startedAt = Date.now();

  const proc = Bun.spawn(cmd, {
    stdin: stdinBuffer,
    cwd: opts.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: opts.env ?? process.env,
  });

  const stdoutPromise = captureStream(proc.stdout, maxOutputChars);
  const stderrPromise = captureStream(proc.stderr, maxOutputChars);

  let timedOut = false;

  const timeoutHandle =
    typeof timeoutMs === "number"
      ? setTimeout(async () => {
          timedOut = true;
          await terminateProcess(proc, platform);
        }, timeoutMs)
      : null;

  const [stdoutResult, stderrResult, exitCodeRaw] = await Promise.all([
    stdoutPromise,
    stderrPromise,
    proc.exited,
  ]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  const exitCode = exitCodeRaw ?? (timedOut ? 124 : 1);

  return {
    exitCode,
    stdout: stdoutResult.output,
    stderr: stderrResult.output,
    timedOut,
    stdoutTruncated: stdoutResult.truncated,
    stderrTruncated: stderrResult.truncated,
    durationMs: Date.now() - startedAt,
  };
};
