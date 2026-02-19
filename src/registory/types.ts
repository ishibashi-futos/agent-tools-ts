/**
 * Chat Completions の tools 入力に渡す function tool 互換型。
 * 配布対象の src では openai パッケージへ依存しない。
 */
export type FunctionParameters = {
  [key: string]: unknown;
};

export type FunctionDefinition = {
  name: string;
  description?: string;
  parameters?: FunctionParameters;
  strict?: boolean | null;
};

export type Tool = {
  type: "function";
  function: FunctionDefinition;
};
