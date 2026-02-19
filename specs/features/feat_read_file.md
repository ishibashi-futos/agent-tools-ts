# Feature Spec: `read_file`

優先度: P0

## 1. 目的

`read_file` は、ワークスペース内の単一ファイル内容を安全かつ再現可能に取得するための基盤ツールである。
本機能は `apply_patch` 前の差分確認、`search` 系ツールの詳細確認、テスト失敗時のログ参照に直結する。
初期版は「安定性と安全性」を最優先し、複雑な読み取りオプションを持たないシンプルな仕様に固定する。

## 2. ユースケース

- 開発者が `apply_patch` 実行前に対象ファイルの現内容を確認するために使い、誤編集を防ぐ
- エージェントが `search` ヒット後に該当ファイル全体を読み、修正方針を確定する
- テスト失敗時にログ出力ファイルを読み、失敗原因の一次切り分けを行う
- 設定ファイルを読み、後続ツールの入力値を決定する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `path` で指定された単一ファイルを UTF-8 テキストとして読み取り、内容を返す
- 既定値 `max_lines=200` で行数を制限し、上限を超える場合は先頭から `max_lines` 行のみ返す
- `start_line` を指定した場合は、その行から `max_lines` 行までを返す
- `path` はワークスペース内に正規化され、外部パスは拒否される
- 返却する `path` は常に `workspaceRoot` 起点の相対パスとし、絶対パスを返さない
- 対象が存在しない場合、ディレクトリの場合、サイズ上限超過の場合に明示的エラーを返す
- バイナリ判定されたファイルは初期版では読み取り拒否する
- 上限超過時は `truncated=true` と `next_start_line` を返し、未超過時は `truncated=false` と `next_start_line=null` を返す
- 同一入力に対して同一出力（`content` と `meta`）を返す

### 3.2 SHOULD

- 出力に `line_count` / `returned_line_count` / `byte_length` / `mtime_ms` を含め、呼び出し側がキャッシュ判定と継続読み取り判定をできるようにする
- エラーメッセージに `path` と失敗理由を含め、再実行判断をしやすくする
- ファイルサイズ上限 1 MiB を定数として固定し、実装とテストで同一値を参照する

### 3.3 WON'T（初期版では非対応）

- 終了行直接指定（`end_line`）や複数レンジ同時取得
- 文字コード自動判定（Shift_JIS 等）
- 巨大ファイルの部分読み取り・ストリーミング返却
- JSON/YAML など構造化パース

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type ReadFileInput = {
  path: string; // 必須。createSecureTool により workspace 内の絶対パスへ正規化
  start_line?: number; // default: 1, min: 1
  max_lines?: number; // default: 200, min: 1, max: 500
};
```

### 4.2 Output

```ts
type ReadFileOutput = {
  path: string; // workspaceRoot 起点の相対パス
  content: string; // UTF-8 文字列
  truncated: boolean; // 行数上限で切り詰めた場合 true
  next_start_line: number | null; // truncated=true の場合は次回読み取り開始行
  meta: {
    byte_length: number; // ファイルサイズ（bytes）
    line_count: number; // ファイル全体の行数
    returned_line_count: number; // 今回返却した行数
    mtime_ms: number; // 最終更新時刻（epoch milliseconds）
  };
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: `path` が空文字、または文字列でない
- `NOT_FOUND`: 指定ファイルが存在しない
- `NOT_FILE`: 指定パスがディレクトリまたは特殊ファイル
- `BINARY_NOT_SUPPORTED`: バイナリファイル判定により拒否
- `SIZE_LIMIT_EXCEEDED`: 上限（初期値: 1 MiB）を超過
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.read_file` は次の定義と一致させる。

```ts
const READ_FILE_DEFINITION = {
  name: "read_file",
  description:
    "Reads a UTF-8 text file in the workspace and returns a line-limited content window.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Workspace-root-relative file path to read (e.g., \"src/main.ts\").",
      },
      start_line: {
        type: "number",
        default: 1,
        description: "1-based start line of the returned window (default: 1).",
      },
      max_lines: {
        type: "number",
        default: 200,
        description: "Maximum number of lines to return (default: 200).",
      },
    },
    required: ["path"],
  },
} as const;
```

- `description` は 1 文で機能が分かる短い英語を維持する
- `start_line` / `max_lines` は `default` を持ち、`description` にも `(default: X)` を明記する
- 本節の文言は実装の `TOOL_DEFINITIONS.read_file` と完全一致させる

## 5. 読み取りモデル設計

- 単位は「1ファイル + 行ウィンドウ」とし、`start_line` と `max_lines` で返却範囲を決める
- フローは `stat -> 種別検証 -> サイズ検証 -> バイナリ判定 -> text 読み取り -> メタ生成` の固定順
- 改行は `\r\n` を `\n` に正規化して行分割し、`line_count` / `returned_line_count` / `next_start_line` を算出する
- バイナリ判定は先頭チャンクに `NUL` バイトを含むかで判定する
- `start_line` が総行数を超える場合は `content=""` / `truncated=false` / `next_start_line=null` を返す

## 6. ランキング/優先順位設計

- 初期版では非適用（単一ファイル読み取りのため順位付け対象なし）
- 複数候補が発生する仕様を導入しないことで、結果の再現性を担保する

## 7. フィルタ設計

- `path` のみを受け取り、include/exclude フィルタは初期版では持たない
- パス検証は `SandboxPath.resolveInWorkspace` を唯一の入口として適用する
- セキュリティ優先順位は「policy 判定 -> sandbox 判定 -> 実処理」とする

## 8. 実装分割（モジュール責務）

- `src/tools/edit/read_file/tool.ts`
  - I/O バリデーション、`ReadFileInput` から usecase 呼び出し、`ReadFileOutput` 変換
- `src/tools/edit/read_file/usecase.ts`
  - 読み取りフロー本体（stat・サイズ検証・バイナリ判定・本文取得）
- `src/tools/edit/read_file/file_guard.ts`
  - ファイル種別/サイズ/バイナリ判定ロジックを集約
- `src/lib.ts`
  - `ToolCatalog.read_file` と `createAgentToolkit().readFile` の公開
- `src/registory/definitions.ts`
  - `read_file` のツール定義（JSON Schema）追加
- `test/tools/edit/read_file/tool.test.ts`
  - 正常系、存在しないファイル、ディレクトリ指定、サイズ上限超過、バイナリ拒否を検証

既存の `src/tools/edit/apply_patch.ts` とは責務を分離し、読み取り処理を共通化しない（初期版で過剰抽象を避ける）。
`createSecureTool` の第1引数パス正規化仕様に合わせ、`read_file` も第1引数を `path` に固定して衝突を防ぐ。

## 9. 将来拡張

- `search_with_context` 連携: ヒット行前後のみ返す部分読み取り API を追加し、検索結果表示コストを削減
- `codebase_search` 連携: `snippet` だけで不足する場合に `read_file` を自動フォールバックして全文確認
- `tree` / `list_files` 連携: 列挙結果から安全に逐次読み込みするバッチ API（件数上限付き）
- `exec_command` 連携: コマンド出力パスを `read_file` で取得して後処理するワークフローを標準化

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |

## 11. 受け入れ基準（Definition of Done）

- `path` に既存テキストファイルを渡すと `content` と `meta` を返す
- `max_lines` 未指定時に 200 行で打ち切られ、超過時は `truncated=true` と `next_start_line=201` になる
- `start_line` と `max_lines` 指定時に返却行数が `max_lines` 以内である
- ワークスペース外パスは sandbox で拒否される
- 存在しないファイル、ディレクトリ、サイズ上限超過、バイナリでそれぞれ規定エラーとなる
- `line_count` / `returned_line_count` / `byte_length` が実ファイルと一致する
- 返却される `path` は `workspaceRoot` 起点の相対パスであり、絶対パスを含まない
- `ToolCatalog` と `TOOL_DEFINITIONS` に `read_file` が登録される
- `test/tools/edit/read_file/tool.test.ts` の主要ケースが pass する
- `bun test` が成功する
