# Feature Spec: `exec_command`

優先度: P0

## 1. 目的

`exec_command` は、ワークスペース内で単発コマンドを実行し、標準出力/標準エラー/終了コードを再現可能に取得するための基盤ツールである。
本機能は `git_status_summary` の実装、ビルド/テストコマンドの実行、診断用コマンドの安全な実行に直結する。
初期版は「安全性と決定性」を最優先し、Windows/macOS/Linux で同等に扱える非対話コマンド実行に限定する。

## 2. ユースケース

- エージェントが `git status --short` を実行し、変更状態を機械可読なテキストとして取得する
- 開発者が `bun test` を実行し、失敗時のエラーログを `stderr` から確認する
- エージェントが `bun run format` を実行し、終了コードで成功/失敗を判定する
- CI 調査時に `cwd` を指定してサブディレクトリでコマンドを実行する
- 開発者がバージョン管理ツール（例: `mise`）経由の `bun test` を実行し、現在の環境設定で実行結果を取得する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `cwd` と `command` を受け取り、非対話で 1 回だけコマンドを実行する
- `cwd` は `createSecureTool` によるワークスペース内正規化を前提とし、外部パスを拒否する
- `command` は 1 要素以上の文字列配列のみ許可し、先頭要素を実行ファイル名として扱う
- エージェントは `command` に「実行したい本体コマンド」だけを渡し、シェル起動パラメータ（例: `zsh -lc`, `pwsh.exe -Command`）を含めない
- `cwd` は `/` と `\\` のどちらの区切りでも受け付け、正規化後の実ディレクトリで実行する
- 子プロセス環境変数は `process.env` をそのまま継承する（環境初期化は呼び出し側責務）
- コマンド解決は OS 差異を吸収し、Windows では `PATHEXT`（`.EXE/.CMD/.BAT` など）を考慮する
- `shell_mode` 既定値は `"default"` とし、Windows は `pwsh.exe -NoLogo -NoProfile -Command`、macOS は `zsh -lc` で実行する
- 実行完了時に `exit_code` / `stdout` / `stderr` / `timed_out` を返す
- 既定値 `timeout_ms=30_000` を適用する
- `timeout_ms` 超過時はプロセスを停止し、収集済みの `stdout` / `stderr` を保持したまま `timed_out=true` で返す
- `stdin` が指定された場合は UTF-8 文字列として子プロセスへ渡す
- 同一入力に対して、終了コードと出力内容をそのまま返す（内部で整形・改変しない）
- 実行中の例外は `INTERNAL` として明示的に返す

### 3.2 SHOULD

- 出力肥大化を防ぐため、`stdout` と `stderr` はそれぞれ既定 200_000 文字で打ち切り、`*_truncated` を返す
- `duration_ms` を返し、呼び出し側がタイムアウト調整やリトライ判定に使えるようにする
- 環境差分を減らすため、子プロセスには親プロセス環境変数をそのまま引き継ぐ
- コマンド未検出時のエラー文に「解決対象コマンド名」を含め、再実行判断をしやすくする

### 3.3 WON'T（初期版では非対応）

- 対話型セッション（TTY 割り当て、継続 stdin 書き込み）
- バックグラウンド起動とプロセス一覧/停止（`spawn_service` 系で対応）
- Linux のデフォルトシェル自動選択（初期版は macOS/Windows のみ固定）
- 任意環境変数の上書き注入
- シェル初期化スクリプトの自動実行（特定ツールの初期化コマンドを内部で実行する処理）

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type ExecCommandInput = {
  cwd: string; // 必須。workspace 内ディレクトリ
  command: string[]; // 必須。minItems: 1。例: ["git", "status", "--short"]
  shell_mode?: "default" | "direct"; // default: "default"（default は OS 既定シェル経由、direct は配列直接実行）
  stdin?: string; // 任意。UTF-8 文字列
  timeout_ms?: number; // default: 30000, min: 1, max: 120000
  max_output_chars?: number; // default: 200000, min: 1000, max: 1000000
};
```

### 4.2 Output

```ts
type ExecCommandOutput = {
  cwd: string; // 実際に実行した絶対パス
  command: string[]; // 実行した引数列
  exit_code: number; // プロセス終了コード（timeout 時は 124）
  stdout: string; // 標準出力（必要に応じて打ち切り）
  stderr: string; // 標準エラー（必要に応じて打ち切り）
  stdout_truncated: boolean; // stdout 打ち切り時 true
  stderr_truncated: boolean; // stderr 打ち切り時 true
  timed_out: boolean; // タイムアウト時 true
  duration_ms: number; // 実行開始から終了までの経過時間
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: `cwd` 空文字、`command` 空配列/非文字列要素、`timeout_ms`/`max_output_chars` 範囲外
- `NOT_DIRECTORY`: `cwd` が存在しない、またはディレクトリでない
- `COMMAND_NOT_FOUND`: `shell_mode="direct"` で `command[0]` が PATH（Windows では PATHEXT 含む）で解決できない
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.exec_command` には次の文言を固定で使う。

```ts
const EXEC_COMMAND_TOOL_DEFINITION = {
  name: "exec_command",
  description: "Runs a command once in the workspace and returns stdout, stderr, and exit code.",
  parameters: {
    type: "object",
    properties: {
      cwd: {
        type: "string",
        description: "Working directory path in workspace.",
      },
      command: {
        type: "array",
        items: { type: "string" },
        description: "Only the target command tokens to run (e.g. bun run dev).",
      },
      shell_mode: {
        type: "string",
        enum: ["default", "direct"],
        default: "default",
        description: "Use default to apply OS shell wrapper automatically (default: default).",
      },
      stdin: {
        type: "string",
        description: "UTF-8 stdin text.",
      },
      timeout_ms: {
        type: "number",
        default: 30000,
        description: "Execution timeout in milliseconds (default: 30000).",
      },
      max_output_chars: {
        type: "number",
        default: 200000,
        description: "Per-stream output char limit (default: 200000).",
      },
    },
    required: ["cwd", "command"],
  },
} as const;
```

## 5. 実行モデル設計

- 実行単位は「1 リクエスト = 1 子プロセス」とし、常に待機完了まで同期的に処理する
- フローは `入力検証 -> cwd 検証 -> 実行モード決定 -> spawn -> timeout 監視 -> 出力収集 -> 打ち切り判定 -> 返却` の固定順とする
- 実行は `src/utils/exec.ts` の `spawn(cmd, { cwd, stdin })` を利用する
- `shell_mode="default"` は OS ごとのシェルで実行し、Windows は `pwsh.exe -NoLogo -NoProfile -Command`、macOS は `zsh -lc` を使う
- `shell_mode="direct"` は `command` 配列を直接実行する
- `shell_mode="direct"` 時のコマンド解決は `command[0]` がパス指定なら直接実行し、パス指定でなければ PATH 探索で解決する
- Windows の PATH 探索は `PATHEXT` を使い、拡張子省略時も `.exe/.cmd/.bat` を解決対象に含める
- `timeout_ms` 超過時は Unix 系では `SIGTERM` 後に猶予を置いて強制終了、Windows では `taskkill /T /F` 相当でプロセスツリーを強制停止し、`exit_code=124` と `timed_out=true` を返す
- 出力打ち切りは文字数基準で行い、上限超過時は先頭から `max_output_chars` 文字を返す
- `duration_ms` は `Date.now()` 差分で算出し、初期版では高精度時計へ切り替えない

## 6. ランキング/優先順位設計

- 初期版では非適用（検索や候補順位付け機能ではないため）
- 返却順序は単一結果固定であり、同一入力時の判定ロジック分岐を持たない

## 7. フィルタ設計

- 実行許可判定の優先順位は `policy 判定 -> sandbox 判定 -> cwd 実在確認 -> 実行` とする
- `command` の先頭トークンに対する allow/deny リストは初期版では導入しない
- `cwd` は workspace 内ディレクトリのみ許可し、ファイルパス指定は `NOT_DIRECTORY` で拒否する
- 出力は `max_output_chars` で必ず制限し、メモリ使用量を上限化する
- 外部ツールチェーン（例: `mise`）の初期化や PATH 調整は呼び出し側責務とし、`exec_command` は環境不備の特別扱いをしない

## 8. 実装分割（モジュール責務）

- `src/tools/exec/exec_command/tool.ts`
  - `ExecCommandInput` 検証、`cwd`/`command` を usecase へ渡し、`ExecCommandOutput` を返却
- `src/tools/exec/exec_command/usecase.ts`
  - spawn 実行、タイムアウト監視、出力打ち切り、経過時間計測
- `src/tools/exec/exec_command/validator.ts`
  - `command` 配列、`shell_mode`、`timeout_ms`、`max_output_chars` の検証
- `src/tools/exec/exec_command/resolve_command.ts`
  - `shell_mode` と OS に基づく実行コマンド生成、`direct` 時の PATH/PATHEXT 解決、`COMMAND_NOT_FOUND` 生成
- `src/utils/exec.ts`
  - 既存 `spawn` を再利用し、必要に応じて timeout 制御を追加
- `src/lib.ts`
  - `ToolCatalog.exec_command` と `createAgentToolkit().execCommand` を公開
- `src/registory/definitions.ts`
  - `exec_command` の JSON Schema を追加
- `test/tools/exec/exec_command/tool.test.ts`
  - 正常系、`cwd` 不正、`command` 不正、timeout、出力打ち切りを検証
- `test/tools/exec/exec_command/usecase.test.ts`
  - タイムアウト kill、`duration_ms`、`stdout_truncated`/`stderr_truncated` を検証

既存 `src/tools/edit/apply_patch.ts` とは責務を分離し、コマンド実行基盤のみ `src/utils/exec.ts` を共有する。
`createSecureTool` の第1引数をパスとして扱う制約に合わせ、`exec_command` の公開シグネチャは `execCommand(cwd, input)` ではなく `execCommand(cwd, command, options?)` の形を採用して衝突を回避する。

## 9. 将来拡張

- `spawn_service` 連携: `exec_command` の実行基盤を拡張し、常駐プロセス管理へ接続する
- `git_status_summary` 連携: `exec_command` を内部利用して git 状態取得の実装重複を避ける
- `get_service_logs` 連携: 出力打ち切りロジックを共通化し、ログ取得時のメモリ上限を統一する
- `codebase_search` 連携: 外部インデクサ起動コマンドを `exec_command` 経由で統制する
- 外部ランタイム管理ツール連携: バージョン管理された実行環境でも同一 I/O で扱えるようにする

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |

## 11. 受け入れ基準（Definition of Done）

- `cwd` に既存ディレクトリ、`command=["echo","hello"]` を渡すと `exit_code=0` と `stdout` が返る
- `command` が空配列または非文字列要素を含む場合は `INVALID_ARGUMENT` を返す
- `cwd` が存在しない、またはファイルパスの場合は `NOT_DIRECTORY` を返す
- `shell_mode="direct"` で `command[0]` が解決できない場合は `COMMAND_NOT_FOUND` を返し、メッセージにコマンド名を含む
- `timeout_ms` 超過時に子プロセスが停止され、`timed_out=true` / `exit_code=124` と部分 `stdout`/`stderr` を返す
- Windows の timeout では対象プロセスと子孫プロセスが強制停止され、後続テストで孤児プロセスが残らない
- `stdout`/`stderr` が `max_output_chars` を超える場合、上限文字数で打ち切られ `*_truncated=true` になる
- 同一入力で `command`/`cwd` が返却値にそのまま反映される
- Windows 環境で `shell_mode="default"` により `pwsh.exe` 経由で `echo hello` が `exit_code=0` で完了する
- macOS 環境で `shell_mode="default"` により `zsh -lc` 経由で `echo hello` が `exit_code=0` で完了する
- バージョン管理ツール（例: `mise`）配下の実行環境でも、追加の初期化処理なしで同一 I/O 仕様で扱える
- `ToolCatalog` と `TOOL_DEFINITIONS` に `exec_command` が登録される
- `TOOL_DEFINITIONS.exec_command.description` と各 parameter description が本仕様 `4.4` と完全一致する
- `test/tools/exec/exec_command/tool.test.ts` と `test/tools/exec/exec_command/usecase.test.ts` の主要ケースが pass する
- `bun test` が成功する

未確定事項サマリ:
- なし
