# Feature Spec: `invoke_tool_call`

優先度: P1

## 1. 目的

LLM から返る `tool_calls` を都度 `if` 分岐で解釈せず、tool name と arguments から直接ツール実行できる入口を toolkit に追加する。
公開 API は `invoke(name, args)` の 1 つに統一し、呼び出し側の分岐ロジックと実行処理の重複をなくす。
既存ツール（`read_file` / `apply_patch` など）は `toolkit.tools` 配下へ移行し、`getAllowedTools()` などツール実行以外の関数はトップレベルに維持する。
初期版は「単一 tool_call を決定的に実行する」ことを唯一の正解として、機能を最小化する。

## 2. ユースケース

- エージェント実装者が `tool_calls[0].function.name` と parse 済み `arguments` を `invoke` に渡して実行する
- 呼び出し側が `toolkit.invoke("read_file", { path: "src/lib.ts" })` のように tool 名と引数で直接実行する
- 未許可 tool が指定された場合に `TOOL_NOT_ALLOWED` で即時拒否し、安全境界を維持する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `createAgentToolkit(context)` の戻り値に `invoke(name, args)` を追加する
- 既存ツール実行 API は `toolkit.tools.<tool_name>(...)` に移行する（破壊的変更）
- `getAllowedTools()` など非ツール関数は `toolkit` 直下に維持する
- `name` が `ToolCatalog` に存在しない場合は `TOOL_NOT_FOUND` を返す
- name が存在しても policy 上 `deny` の場合は `TOOL_NOT_ALLOWED` を返す
- `invoke(name, args)` は `args` を object のみ許可する
- parse 済み object を対象ツールの入力として渡し、既存 validator のエラーはそのまま返す
- 成功時は tool message 用の `role: "function"` / `name` / `content` を返す
- `invoke` は `name` に応じて `content` の型が解決される（コンパイル時）
- 実行対象は既存公開ツール（`apply_patch` / `exec_command` / `tree` / `read_file` / `git_status_summary`）に限定する

### 3.2 SHOULD

- `invoke` の内部実装は共通関数に集約し、name 解決・policy 判定・実行の重複をなくす
- 呼び出し側が `ChatCompletionMessageToolCall` を使う場合の変換ユーティリティを別関数で提供してもよい（公開 API には含めない）
- エラーに `tool_name` を含め、呼び出し側ログの追跡性を確保する

### 3.3 WON'T（初期版では非対応）

- 複数 tool_call のバッチ実行
- tool 実行の自動リトライ
- JSON Schema による追加 runtime バリデーション（各 tool validator に委譲）
- `ChatCompletionMessageToolCall` の直接受け取り API
- `responses` API 形式の tool call 直接受け取り

## 4. 入出力仕様（Tool I/O）

この機能は toolkit の実行補助 API であり、独立した tool 定義は追加しない。

### 4.1 Input

```ts
type ToolArgsByName = {
  apply_patch: ApplyPatchInput;
  exec_command: ExecCommandInput;
  tree: TreeInput;
  read_file: ReadFileInput;
  git_status_summary: GitStatusSummaryInput;
};

type ToolResultByName = {
  apply_patch: ApplyPatchOutput;
  exec_command: ExecCommandOutput;
  tree: TreeOutput;
  read_file: ReadFileOutput;
  git_status_summary: GitStatusSummaryOutput;
};

type ToolkitInvokeInput<TName extends keyof ToolArgsByName> = {
  name: TName;
  args: Record<string, unknown>;
};
```

### 4.2 Output

```ts
type ToolkitInvokeOutput<TName extends keyof ToolResultByName> = {
  role: "function";
  name: TName;
  content: ToolResultByName[TName];
};
```

```ts
type Invoke = <TName extends keyof ToolArgsByName>(
  name: TName,
  args: Record<string, unknown>,
) => Promise<ToolkitInvokeOutput<TName>>;
```

### 4.3 Error

- `INVALID_TOOL_ARGUMENTS_TYPE`: `invoke` の `args` が object でない
- `TOOL_NOT_FOUND`: 指定された tool 名が存在しない
- `TOOL_NOT_ALLOWED`: policy が `deny`
- `INTERNAL`: 想定外エラー

## 5. 実行モデル設計

- 共通フローは `name解決 -> policy許可判定 -> 引数検証 -> tool handler 実行 -> 標準化レスポンス返却` の固定順とする
- `invoke` の実行時 security 境界は `SecurityPolicy` / `SandboxFS` / `SandboxPath` を共通フロー内で適用して維持する
- 返却 `content` は tool の生戻り値を改変せず保持する

## 6. ランキング/優先順位設計

- 初期版では非適用（検索・順位付け機能ではないため）

## 7. フィルタ設計

- `invoke` で受け付ける tool 名は `ToolCatalog` キーのみ
- policy 判定優先順位は `context.policy.tools[name]` を優先し、未設定時に `defaultPolicy` を使う
- `TOOL_NOT_FOUND` と `TOOL_NOT_ALLOWED` は区別して返し、失敗原因を明確化する

## 8. 実装分割（モジュール責務）

- `src/lib.ts`
  - `createAgentToolkit` の戻り値へ型付き `invoke` を追加する
  - 既存ツール関数を `toolkit.tools` 配下へ移動し、`getAllowedTools()` はトップレベルに維持する
- `src/toolkit/invoke/index.ts`（新規）
  - `tool 名解決 / policy 判定 / 引数検証 / 実行` の共通処理を実装する
  - `ToolArgsByName` / `ToolResultByName` の対応表を定義し、`invoke` の型推論に使う
- `src/toolkit/invoke/error.ts`（新規）
  - `INVALID_TOOL_ARGUMENTS_TYPE` などの専用エラー型を定義する
- `test/lib.test.ts`
  - toolkit 経由で `invoke` の正常系を検証する
- `test/registory/invoke.test.ts`（新規）
  - `TOOL_NOT_FOUND` / `TOOL_NOT_ALLOWED` / 引数型エラーを検証する

既存 `createSecureTool` と各 tool 実装の責務は変更せず、「呼び出し分岐の共通化」だけを新規責務として追加する。
公開 API は破壊的変更として `toolkit.readFile()` 形式を廃止し、`toolkit.tools.read_file()` 形式に統一する。

## 9. 将来拡張

- `tool_calls` 配列を逐次実行する `invokeAll(toolCalls)` を追加する
- `ChatCompletionMessageToolCall` を `invoke` 入力へ変換する小さなヘルパーを追加する
- `responses` API 向け call 形式を同一実行基盤に統合する
- 監査ログ機能追加時に `tool_call_id` をキーとして実行履歴を関連付ける

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| なし | 初期版では追加の未決事項なし |

## 11. 受け入れ基準（Definition of Done）

- `createAgentToolkit(context)` の戻り値に `invoke` が追加されている
- `createAgentToolkit(context)` の戻り値に `tools` があり、`tools.read_file` / `tools.apply_patch` など既存ツールが利用できる
- `createAgentToolkit(context)` の戻り値で `getAllowedTools()` がトップレベルに維持されている
- 未登録 tool 名は `TOOL_NOT_FOUND` が返る
- policy deny の tool は `TOOL_NOT_ALLOWED` が返る
- `invoke("read_file", { path: "src/lib.ts" })` で `read_file` 実行結果が返る
- `invoke("read_file", { path: "src/lib.ts" })` の成功戻り値に `role` / `name` / `content` が含まれる
- `invoke("read_file", { path: "src/lib.ts" })` の `content` が `ReadFileOutput` として型推論される
- `invoke("read_file", 123 as unknown as Record<string, unknown>)` で `INVALID_TOOL_ARGUMENTS_TYPE` が返る
- `bun test` が成功する

未確定事項サマリ:
- 未確定事項なし。
