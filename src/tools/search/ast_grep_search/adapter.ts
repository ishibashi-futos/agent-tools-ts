import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  type SpawnOptions,
  type SpawnResult,
  spawn,
} from "../../../utils/exec";
import { AstGrepSearchError } from "./error";
import type {
  AstGrepAdapterInput,
  AstGrepAdapterOutput,
  AstGrepJsonMatch,
} from "./types";

const TEMP_DIR_PREFIX = "ast-grep-search-";
const RULE_FILE_NAME = "rule.yml";
const RULE_ID = "ast-grep-search-rule";
const MAX_OUTPUT_CHARS = 10_000_000;
const DEFAULT_EXCLUDE_GLOBS = [
  "!.git/**",
  "!node_modules/**",
  "!dist/**",
  "!build/**",
  "!target/**",
  "!.vscode/**",
] as const;

type Dependencies = {
  mkdtemp: typeof mkdtemp;
  writeFile: typeof writeFile;
  rm: typeof rm;
  spawn: (cmd: string[], options?: SpawnOptions) => Promise<SpawnResult>;
};

const toWorkspaceRelativePath = (
  workspaceRoot: string,
  filePath: string,
): string => {
  const relativePath = relative(workspaceRoot, filePath).replace(/\\/g, "/");
  return relativePath.length === 0 ? "." : relativePath;
};

const normalizeMatchFile = (
  workspaceRoot: string,
  rawMatch: AstGrepJsonMatch,
): AstGrepJsonMatch => {
  if (typeof rawMatch.file !== "string" || rawMatch.file.length === 0) {
    throw new AstGrepSearchError("INTERNAL", "sg result does not contain file");
  }

  return {
    ...rawMatch,
    file: toWorkspaceRelativePath(workspaceRoot, rawMatch.file),
  };
};

const parseJsonStream = (
  stdout: string,
  workspaceRoot: string,
): AstGrepJsonMatch[] => {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const items: AstGrepJsonMatch[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      if (error instanceof Error) {
        throw new AstGrepSearchError("INTERNAL", error.message);
      }
      throw new AstGrepSearchError("INTERNAL", String(error));
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new AstGrepSearchError(
        "INTERNAL",
        "sg returned non-object JSON entry",
      );
    }

    items.push(normalizeMatchFile(workspaceRoot, parsed as AstGrepJsonMatch));
  }

  return items;
};

const buildRuleYaml = (
  language: string,
  rule: Record<string, unknown>,
): string => {
  return [
    `id: ${RULE_ID}`,
    `language: ${JSON.stringify(language)}`,
    `rule: ${JSON.stringify(rule)}`,
    "",
  ].join("\n");
};

const normalizeSgError = (
  result: SpawnResult,
  fallbackMessage: string,
): AstGrepSearchError => {
  const message =
    `${result.stderr}\n${result.stdout}`.trim() || fallbackMessage;

  if (result.timedOut) {
    return new AstGrepSearchError("TIMEOUT", "search timed out");
  }
  if (message.includes("untagged enum SgLang")) {
    return new AstGrepSearchError("UNSUPPORTED_LANGUAGE", message);
  }
  if (
    message.includes("Cannot parse rule") ||
    message.includes("valid ast-grep rule") ||
    message.includes("Fail to parse yaml as RuleConfig")
  ) {
    return new AstGrepSearchError("INVALID_RULE", message);
  }
  return new AstGrepSearchError("INTERNAL", message);
};

const toSgCommand = (
  input: AstGrepAdapterInput,
  ruleFilePath: string,
): string[] => {
  const searchRoot = toWorkspaceRelativePath(
    input.workspace_root,
    input.root_path,
  );
  const command = [
    "sg",
    "scan",
    "--rule",
    ruleFilePath,
    "--json=stream",
    "--color",
    "never",
    "--report-style",
    "short",
    "--max-results",
    String(input.max_results),
  ];

  for (const glob of DEFAULT_EXCLUDE_GLOBS) {
    command.push("--globs", glob);
  }
  for (const glob of input.include) {
    command.push("--globs", glob);
  }
  for (const glob of input.exclude) {
    command.push("--globs", `!${glob}`);
  }

  command.push(searchRoot === "." ? "." : searchRoot);
  return command;
};

export const createAstGrepSearchAdapter = (
  deps: Dependencies = {
    mkdtemp,
    writeFile,
    rm,
    spawn,
  },
) => {
  return async (input: AstGrepAdapterInput): Promise<AstGrepAdapterOutput> => {
    let tempDirectoryPath: string | null = null;

    try {
      tempDirectoryPath = await deps.mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX));
      const ruleFilePath = join(tempDirectoryPath, RULE_FILE_NAME);

      await deps.writeFile(
        ruleFilePath,
        buildRuleYaml(input.language, input.rule),
        "utf-8",
      );

      let result: SpawnResult;
      try {
        result = await deps.spawn(toSgCommand(input, ruleFilePath), {
          cwd: input.workspace_root,
          timeoutMs: input.timeout_ms,
          maxOutputChars: MAX_OUTPUT_CHARS,
          env: process.env,
          platform: process.platform,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          throw new AstGrepSearchError(
            "DEPENDENCY_MISSING",
            "sg binary is not installed",
          );
        }
        throw error;
      }

      if (result.timedOut) {
        throw new AstGrepSearchError("TIMEOUT", "search timed out");
      }
      if (result.stdoutTruncated || result.stderrTruncated) {
        throw new AstGrepSearchError(
          "INTERNAL",
          "sg output exceeded capture limit",
        );
      }
      if (result.exitCode !== 0) {
        throw normalizeSgError(result, "sg scan failed");
      }

      const items = parseJsonStream(result.stdout, input.workspace_root);
      return {
        items,
        truncated: items.length >= input.max_results,
        warnings: [],
      };
    } finally {
      if (tempDirectoryPath !== null) {
        await deps.rm(tempDirectoryPath, { recursive: true, force: true });
      }
    }
  };
};

export const astGrepSearchAdapter = createAstGrepSearchAdapter();
