# Feature Spec: `regexp_search`

優先度: `P1`

## 1. 目的

`regexp_search` は、正規表現でコードベース内の文字列パターンを高速かつ決定的に検索するための基盤ツールである。
本機能は `search_with_context`・`symbol_usage`・`ast_grep_search` などの後続検索機能に先行して、最小の検索プリミティブを提供する。
初期版は「シンプルで唯一の正解」を優先し、インデックスを持たない逐次走査と明確な入出力に限定する。

## 2. ユースケース

- エージェントが `TODO\(.*\)` のような正規表現で実装中コメントを一括検出し、対応漏れを防ぐ
- エージェントが Windows 形式パス（例: `src\\tools\\.*\\tool\\.ts`）を含む文字列を検索し、移植時の不整合を特定する
- 開発者が `describe\(` を検索して既存テストの配置箇所を短時間で把握する
- リファクタ前に `deprecated|legacy` を横断検索し、変更影響範囲を先に収集する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `pattern` を必須入力として受け取り、ワークスペース内テキストファイルを再帰走査して一致箇所を返す
- `flags` は `g` `i` `m` `s` `u` のみ受け付け、その他フラグを拒否する
- `root_path` は `/` と `\\` の両方を受け付け、内部では `/` に正規化して処理する
- `include` / `exclude` の glob フィルタを提供し、同一パスに対しては `exclude` を優先する
- デフォルト除外ディレクトリ（`.git/` `node_modules/` `dist/` `build/` `target/` `.vscode/`）を適用する
- `must_include` に含まれるパス配下は除外判定より優先して検索対象に必ず含める
- 結果は `path`（workspace 相対）`line` `column` `match` `line_text` を返す
- 出力順は `path` 昇順、同一 `path` 内は `line` 昇順、同一 `line` 内は `column` 昇順で安定化する
- `max_results` 上限到達時は打ち切り、`truncated=true` を返す
- バイナリファイルとサイズ上限超過ファイルはスキップし、`warnings` に件数を記録する
- 正規表現コンパイル失敗時は `INVALID_REGEX` を返す

### 3.2 SHOULD

- `timeout_ms` を超過した場合は `TIMEOUT` を返し、中途半端な部分結果は返さない
- `line_text` は改行を除去した 1 行文字列として返し、呼び出し側がそのまま表示できる形式にする
- `include` / `exclude` パターンの不正（空文字、null 文字、不均衡な `[]` `{}`）を `INVALID_ARGUMENT` で返す

### 3.3 WON'T（初期版では非対応）

- 置換（replace）実行
- マルチライン全文スニペット返却（前後文脈の自動付与）
- キャプチャグループ単位の構造化返却
- インデックス構築やキャッシュ永続化

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type RegexpSearchInput = {
  pattern: string; // 必須、空文字不可
  flags?: string; // 任意、default: "", 許可: g/i/m/s/u のみ（重複不可）
  root_path?: string; // 任意、default: "."、/ と \\ を受け付ける
  include?: string[]; // 任意、glob 配列
  exclude?: string[]; // 任意、glob 配列（include より優先）
  must_include?: string[]; // 任意、除外判定より優先して検索対象に含めるパス（例: ["dist", "target/generated"]）
  max_results?: number; // 任意、default: 100、min: 1、max: 500
  max_file_size_bytes?: 1048576; // 任意、default: 1048576（1 MiB 固定）
  timeout_ms?: number; // 任意、default: 5000、min: 1、max: 30000
};
```

### 4.2 Output

```ts
type RegexpSearchOutput = {
  query: {
    pattern: string;
    flags: string;
  };
  root_path: string; // workspaceRoot 起点の相対パス
  took_ms: number;
  truncated: boolean;
  scanned_files: number;
  items: Array<{
    path: string; // workspaceRoot 起点の相対パス（区切りは / ）
    line: number; // 1-based
    column: number; // 1-based
    match: string; // 一致した文字列
    line_text: string; // 一致行の全文（改行なし）
  }>;
  warnings: string[]; // 例: "skipped_binary_files=3", "skipped_size_limit_files=2"
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: 必須項目欠落、型不正、範囲外、不正 glob、不正 flags
- `INVALID_REGEX`: `pattern` と `flags` の組み合わせが正規表現として不正
- `NOT_FOUND`: `root_path` が存在しない
- `NOT_DIRECTORY`: `root_path` がディレクトリではない
- `TIMEOUT`: `timeout_ms` 超過
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.regexp_search` は次の定義と一致させる。

```ts
const REGEXP_SEARCH_DEFINITION = {
  name: "regexp_search",
  description:
    "Searches workspace text files with a regular expression and returns deterministic match locations.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Regular expression pattern source.",
      },
      flags: {
        type: "string",
        default: "",
        description: "Regex flags from g/i/m/s/u only (default: empty).",
      },
      root_path: {
        type: "string",
        default: ".",
        description:
          "Workspace-relative root directory (default: .). Accepts / or \\\\ and requires JSON escaping for backslashes.",
      },
      include: {
        type: "array",
        items: { type: "string" },
        description: "Glob allowlist patterns.",
      },
      exclude: {
        type: "array",
        items: { type: "string" },
        description: "Glob denylist patterns (takes precedence over include).",
      },
      must_include: {
        type: "array",
        items: { type: "string" },
        description:
          "Paths that must be searched even if matched by exclusion filters.",
      },
      max_results: {
        type: "number",
        default: 100,
        description: "Maximum number of matches to return (default: 100).",
      },
      max_file_size_bytes: {
        type: "number",
        default: 1048576,
        enum: [1048576],
        description: "Per-file size limit in bytes (fixed: 1048576).",
      },
      timeout_ms: {
        type: "number",
        default: 5000,
        description: "Search timeout in milliseconds (default: 5000).",
      },
    },
    required: ["pattern"],
  },
} as const;
```

- `description` は短い 1 文英語を維持し、機能を一読で識別できる文言に固定する
- `default` がある項目は `default` と `description` の双方に同じ値を記載する
- `max_file_size_bytes` は初期版で 1MiB（1048576）固定値とし、他値を受け付けない
- Windows パスを含む入力は JSON で `\\` エスケープが必要なことを metadata に明記する

## 5. 検索/判定モデル設計

- 検索単位は「1 ファイル内の 1 行一致」とし、`pattern + flags` を `RegExp` へコンパイルして逐次適用する
- 走査単位は `root_path` 配下の通常ファイルで、ディレクトリは再帰展開する
- 各ファイルは `UTF-8` として読み取り、改行を `\n` に正規化して行単位で一致判定する
- 同一行の複数一致を取りこぼさないため、`flags` に `g` が未指定でも内部では全一致を収集する
- 初期版はインデックスを持たず、毎回フルスキャンする（更新同期処理を持たない）

## 6. ランキング/優先順位設計

- 初期版では非適用（ランキング機能を持たない）
- 返却順は再現性確保のため `path` / `line` / `column` の安定ソートのみ適用する

## 7. フィルタ設計

- フィルタ適用順は `exclude` 判定 -> `include` 判定 -> ファイルサイズ判定 -> バイナリ判定とする
- `exclude` は常に優先し、`include` に一致しても `exclude` 一致時は除外する
- デフォルト除外は `.git/**` `node_modules/**` `dist/**` `build/**` `target/**` `.vscode/**` とする
- `must_include` は最優先で適用し、`exclude` とデフォルト除外の両方を上書きして検索対象に含める
- パス区切りは入力時に `\\` を `/` へ正規化し、glob 評価と出力パスを `/` 統一で扱う
- 隠しファイルの扱いは `tree` と同様にデフォルト除外を優先し、個別 include 指定があれば許可する

## 8. 実装分割（モジュール責務）

- `src/tools/search/regexp_search/types.ts`（新規）
  - `RegexpSearchInput` / `RegexpSearchOutput` / tool 固有エラー型を定義する
- `src/tools/search/regexp_search/validator.ts`（新規）
  - 入力制約（flags, range, glob 形式, 文字列制約）を検証する
- `src/tools/search/regexp_search/path_filter.ts`（新規）
  - include/exclude とデフォルト除外を一元判定する
- `src/tools/search/regexp_search/matcher.ts`（新規）
  - 1 ファイル内の行分割と正規表現一致抽出を担当する
- `src/tools/search/regexp_search/usecase.ts`（新規）
  - 走査、タイムアウト監視、結果上限制御、warnings 集約を担当する
- `src/tools/search/regexp_search/tool.ts`（新規）
  - I/O 変換、validator 呼び出し、usecase 実行、エラー正規化を担当する
- `src/registory/definitions.ts`（更新）
  - `TOOL_DEFINITIONS.regexp_search` を 4.4 と完全一致で追加する
- `src/lib.ts`（更新）
  - `ToolCatalog` と `createAgentToolkit().tools` に `regexp_search` を登録する
- `src/toolkit/invoke/index.ts`（更新）
  - `ToolArgsByName` / `ToolResultByName` / resolver に `regexp_search` を追加する
- `test/tools/search/regexp_search/tool.test.ts`（新規）
  - 正常系、入力不正、invalid regex、timeout、上限打ち切りを検証する
- `test/tools/search/regexp_search/usecase.test.ts`（新規）
  - ソート安定性、filter 優先順位、Windows 区切り入力の正規化を検証する
- `test/registory/definitions.test.ts` / `test/lib.test.ts` / `test/registory/invoke.test.ts`（更新）
  - 定義登録と invoke 経路の整合を検証する

既存 `src/tools/edit/tree/filter.ts` と責務が近いため、除外規則の重複を避ける方針として、検索系のフィルタ責務は `src/tools/search/regexp_search/path_filter.ts` に閉じる。`tree` 側ロジックは変更せず、ドメイン横断の共通化は `search` 系ツールが 2 つ以上実装された時点で別タスクとして切り出す。

## 9. 将来拡張

- `search_with_context` 連携: `regexp_search` の `path/line` を入力に前後行を取得し、レビュー向け表示を拡張する
- `ast_grep_search` 連携: テキスト一致後に AST 条件で再絞り込みする 2 段検索フローを追加する
- `codebase_search` 連携: セマンティック検索結果を `regexp_search` で検証し、誤ヒット低減の再検証ステップに利用する
- `symbol_usage` 連携: シンボル候補名を正規表現パターンへ変換し、言語非依存な一次スクリーニングとして利用する

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| `must_include` の一致判定を「完全一致」と「配下プレフィックス一致」のどちらで固定するか | `dist` / `dist/sub` / `dist2` の3ケースで期待集合を定義したテストを追加し、誤包含がない方式を採択する |

## 11. 受け入れ基準（Definition of Done）

- `pattern="describe\\("` を含むテキストファイルで一致結果が 1 件以上返り、`line` と `column` が 1 以上である
- `flags="x"` を指定すると `INVALID_ARGUMENT` を返す
- `flags="g"` を指定しても未指定時と同じ一致件数を返す
- 不正正規表現（例: `pattern="("`）で `INVALID_REGEX` を返す
- `include` と `exclude` が同時一致するパスは結果に含まれない
- `must_include=["dist"]` 指定時、`dist/` 配下が検索対象になる
- `must_include=["node_modules/pkg"]` かつ `exclude=["node_modules/**"]` でも `node_modules/pkg` 配下は検索対象になる
- 出力 `items` が `path` / `line` / `column` の昇順で安定している
- `max_results=1` かつ 2 件以上一致する入力で `truncated=true` を返す
- Windows 区切り入力（例: `root_path="src\\tools"`）でも MacOS と同じ結果集合を返す
- `TOOL_DEFINITIONS.regexp_search` が本仕様 4.4 と完全一致する
- `test/tools/search/regexp_search/*.test.ts` が pass する
- `scripts/sanity.sh` が成功する

未確定事項サマリ:
- `must_include` の一致判定方式（完全一致/配下一致）の最終確定が未了。
