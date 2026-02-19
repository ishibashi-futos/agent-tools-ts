import { access, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { constants } from "node:fs";
import { ExecCommandError } from "./error";
import type { ExecCommandShellMode } from "./types";

export type ResolveCommandInput = {
  cwd: string;
  command: string[];
  shellMode: ExecCommandShellMode;
  platform: NodeJS.Platform;
};

export type ResolveCommandOutput = {
  executable: string[];
};

const DEFAULT_WINDOWS_PATHEXT = [".COM", ".EXE", ".BAT", ".CMD"];

const hasPathSeparator = (value: string): boolean => {
  return value.includes("/") || value.includes("\\");
};

const quotePosix = (token: string): string => {
  if (token.length === 0) {
    return "''";
  }
  return `'${token.replace(/'/g, `'"'"'`)}'`;
};

const quotePowerShell = (token: string): string => {
  return `'${token.replace(/'/g, "''")}'`;
};

const toShellCommandLine = (command: string[]): string => {
  return command.map(quotePosix).join(" ");
};

const toPowerShellCommandLine = (command: string[]): string => {
  const quoted = command.map(quotePowerShell);
  return `& ${quoted.join(" ")}`;
};

const isExecutableFile = async (
  candidatePath: string,
  platform: NodeJS.Platform,
): Promise<boolean> => {
  try {
    const fileStat = await stat(candidatePath);
    if (!fileStat.isFile()) {
      return false;
    }

    if (platform === "win32") {
      return true;
    }

    await access(candidatePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const resolveDirectCommand = async (
  commandName: string,
  cwd: string,
  platform: NodeJS.Platform,
): Promise<string> => {
  if (hasPathSeparator(commandName)) {
    const commandPath = isAbsolute(commandName)
      ? commandName
      : resolve(cwd, commandName);

    if (await isExecutableFile(commandPath, platform)) {
      return commandPath;
    }

    throw new ExecCommandError(
      "COMMAND_NOT_FOUND",
      `command not found: ${commandName}`,
    );
  }

  const pathValue = process.env.PATH ?? "";
  const searchDirs = pathValue
    .split(delimiter)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const candidates: string[] = [];

  if (platform === "win32") {
    const pathExtRaw = process.env.PATHEXT;
    const pathExtValues = (
      pathExtRaw ? pathExtRaw.split(";") : DEFAULT_WINDOWS_PATHEXT
    )
      .map((ext) => ext.trim())
      .filter((ext) => ext.length > 0)
      .map((ext) => ext.toUpperCase());

    const hasKnownExt = pathExtValues.some((ext) =>
      commandName.toUpperCase().endsWith(ext),
    );

    for (const dir of searchDirs) {
      if (hasKnownExt) {
        candidates.push(join(dir, commandName));
      }
      for (const ext of pathExtValues) {
        candidates.push(join(dir, `${commandName}${ext}`));
      }
    }
  } else {
    for (const dir of searchDirs) {
      candidates.push(join(dir, commandName));
    }
  }

  for (const candidate of candidates) {
    if (await isExecutableFile(candidate, platform)) {
      return candidate;
    }
  }

  throw new ExecCommandError(
    "COMMAND_NOT_FOUND",
    `command not found: ${commandName}`,
  );
};

export const resolveExecutionCommand = async (
  input: ResolveCommandInput,
): Promise<ResolveCommandOutput> => {
  const { command, cwd, shellMode, platform } = input;
  const [commandName, ...commandArgs] = command;

  if (commandName === undefined) {
    throw new ExecCommandError(
      "INVALID_ARGUMENT",
      "command must be a non-empty string array",
    );
  }

  if (shellMode === "default") {
    if (platform === "win32") {
      return {
        executable: [
          "pwsh.exe",
          "-NoLogo",
          "-NoProfile",
          "-Command",
          toPowerShellCommandLine(command),
        ],
      };
    }

    if (platform === "darwin") {
      return {
        executable: ["zsh", "-lc", toShellCommandLine(command)],
      };
    }

    // Linux は初期版でデフォルトシェル固定を行わず、直接実行へフォールバックする。
    return {
      executable: command,
    };
  }

  const resolved = await resolveDirectCommand(commandName, cwd, platform);
  return {
    executable: [resolved, ...commandArgs],
  };
};
