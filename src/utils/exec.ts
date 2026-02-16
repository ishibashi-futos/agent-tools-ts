// src/utils/exec.ts
export type SpawnOptions = {
  stdin?: string | Uint8Array; // 文字列も受け取れるように定義
  cwd?: string;
}

export type SpawnResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export const spawn = async (cmd: string[], opts?: SpawnOptions): Promise<SpawnResult> => {
  // 文字列を Uint8Array に変換（Bun.spawn の stdin が受け取れる形式にする）
  const stdinBuffer = typeof opts?.stdin === "string"
    ? new TextEncoder().encode(opts.stdin)
    : opts?.stdin;

  const proc = Bun.spawn(cmd, {
    stdin: stdinBuffer, // これで型エラーが解消されます
    cwd: opts?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCodeRaw] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exitCode,
  ]);

  // exitCode が null の場合は 1 (エラー) として扱う
  const exitCode = exitCodeRaw ?? 1;

  return { exitCode, stdout, stderr };
};