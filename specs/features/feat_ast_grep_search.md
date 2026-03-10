# Feature Spec: `ast_grep_search`

優先度: `P1`

## 1. 目的

`ast_grep_search` は、ast-grep を使ってコードベースを構文木ベースで決定的に検索するための検索ツールである。
`regexp_search` では表現しづらい構造的なコードパターンを、言語ごとの AST に沿って絞り込めるようにする。
初期版は「唯一の正解」を優先し、外部 `sg` バイナリを逐次実行する単純構成と、生 JSON を保った明確な入出力に限定する。

## 2. ユースケース

- エージェントが TypeScript の `export default function $NAME()` パターンを検索し、エントリポイント候補を収集する
- 開発者が Go の `func ($RECV) $METHOD(...)` を検索し、特定 receiver のメソッド実装を横断確認する
- リファクタ前に Rust の `impl $TYPE { $$$ }` を検索し、実装ブロックの分布を把握する
- エージェントが Python の `@$DECORATOR` 付き関数を検索し、フレームワーク依存箇所を調査する
- 開発者が JavaScript の `import { $X } from "$MODULE"` を検索し、依存の使用箇所を洗い出す

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `language` と `rule` を必須入力として受け取る
- `language` は空文字不可の文字列とし、初期版の受け入れテストでは `typescript` `javascript` `python` `go` `rust` を最低保証対象とする
- `rule` は ast-grep の Rule Object を表す JSON object とし、配列・null・非 object は拒否する
- 検索エンジンは外部 `sg` バイナリのみを使用し、内部 fallback を持たない
- `root_path` は `/` と `\\` の両方を受け付け、内部では `/` に正規化して処理する
- `include` / `exclude` の glob フィルタを提供し、同一パスに対しては `exclude` を優先する
- デフォルト除外ディレクトリ（`.git/` `node_modules/` `dist/` `build/` `target/` `.vscode/`）を適用する
- `include` / `exclude` の評価基準は `workspaceRoot` 起点の相対パスとする
- 出力 `items` は `sg` の raw JSON match object を保持しつつ、各 `file` を workspace 相対パスへ `/` 区切りで正規化する
- 出力順は `file` 昇順、同一 `file` 内は `range.start.line` 昇順、次に `range.start.column` 昇順、次に `range.end.line` / `range.end.column` 昇順で安定化する
- `max_results` 上限到達時は以降の検索を打ち切り、`truncated=true` を返す
- `sg` が存在しない場合は `DEPENDENCY_MISSING` を返す
- `language` が ast-grep 側で解釈不能な場合は `UNSUPPORTED_LANGUAGE` を返す
- `rule` が ast-grep 側で不正な場合は `INVALID_RULE` を返す
- `include` / `exclude` の判定ロジックは、`regexp_search` の `path_filter.ts` を再利用せず、sgに任せる

### 3.2 SHOULD

- `timeout_ms` を超過した場合は `TIMEOUT` を返し、中途半端な部分結果は返さない
- `rule` は JSON serializable であることを事前検証し、明らかな不正を `INVALID_ARGUMENT` で早期に返す
- 一時 rule file の作成と削除は adapter に閉じ込め、呼び出し側へ漏らさない
- `warnings` は非致命情報のみを入れ、通常ケースでは空配列を返す

### 3.3 WON'T（初期版では非対応）

- `sg` 以外の実装エンジン（`@ast-grep/napi` など）
- `fix` / `rewriter` / `transform` / `utils` を含む ast-grep のフル lint 設定
- `must_include`
- 検索結果の再整形や独自ランキング
- マッチ前後の文脈行返却

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type AstGrepSearchInput = {
  language: string; // 必須、空文字不可
  rule: Record<string, unknown>; // 必須、ast-grep Rule Object
  root_path?: string; // 任意、default: "."
  include?: string[]; // 任意、workspace 基準 glob
  exclude?: string[]; // 任意、workspace 基準 glob（include より優先）
  max_results?: number; // 任意、default: 100、min: 1、max: 500
  timeout_ms?: number; // 任意、default: 5000、min: 1、max: 30000
};
```

### 4.2 Output

```ts
type AstGrepJsonPosition = {
  line: number; // sg raw JSON の値をそのまま返す
  column: number; // sg raw JSON の値をそのまま返す
  offset?: number;
};

type AstGrepJsonRange = {
  start: AstGrepJsonPosition;
  end: AstGrepJsonPosition;
};

type AstGrepJsonMatch = {
  text: string;
  file: string; // workspaceRoot 起点の相対パス（区切りは / ）
  range: AstGrepJsonRange;
  lines?: string;
  language?: string;
  metaVariables?: Record<string, unknown>;
  ruleId?: string;
  severity?: string;
  message?: string;
  note?: string;
  [key: string]: unknown;
};

type AstGrepSearchOutput = {
  query: {
    language: string;
    rule: Record<string, unknown>;
  };
  root_path: string; // workspaceRoot 起点の相対パス
  took_ms: number;
  truncated: boolean;
  items: AstGrepJsonMatch[];
  warnings: string[];
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: 必須項目欠落、型不正、範囲外、不正 glob、非 serializable rule
- `NOT_FOUND`: `root_path` が存在しない
- `NOT_DIRECTORY`: `root_path` がディレクトリではない
- `INVALID_RULE`: ast-grep が rule を解釈できない
- `UNSUPPORTED_LANGUAGE`: ast-grep が `language` を解釈できない
- `DEPENDENCY_MISSING`: `sg` バイナリが存在しない
- `TIMEOUT`: `timeout_ms` 超過
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.ast_grep_search` は次の定義と一致させる。

```ts
const AST_GREP_SEARCH_DEFINITION = {
  name: "ast_grep_search",
  description:
    "Searches source files with ast-grep and returns raw structured matches.",
  parameters: {
    type: "object",
    properties: {
      language: {
        type: "string",
        description: "ast-grep language name.",
      },
      rule: {
        type: "object",
        description: "ast-grep rule object.",
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
        description:
          "Workspace-relative glob allowlist patterns within searchable paths.",
      },
      exclude: {
        type: "array",
        items: { type: "string" },
        description:
          "Workspace-relative glob denylist patterns (takes precedence over include).",
      },
      max_results: {
        type: "number",
        default: 100,
        description: "Maximum number of matches to return (default: 100).",
      },
      timeout_ms: {
        type: "number",
        default: 5000,
        description: "Search timeout in milliseconds (default: 5000).",
      },
    },
    required: ["language", "rule"],
  },
} as const;
```

- `description` は短い 1 文英語に固定する
- `default` がある項目は `default` と `description` の双方に同じ値を記載する
- `rule` は object としてのみ公開し、YAML 文字列入力は受け付けない
- Windows パス入力は JSON 上で `\\` エスケープが必要なことを metadata に明記する

## 5. 検索/判定モデル設計

- 検索単位は `root_path` 配下の通常ファイルとし、AST 解析自体は `sg` に委譲する
- 実行時に単一 rule を表す一時 YAML file を生成し、`sg scan` に渡す
- `sg` の JSON 出力を逐次 parse して match object を収集する
- 各 match の `file` は adapter で workspace 相対パスへ正規化する
- 初期版は毎回フルスキャンし、インデックスやキャッシュを持たない

## 6. ランキング/優先順位設計

- 初期版ではランキング機能を持たない
- 返却順は `file` / `range.start` / `range.end` の安定ソートのみ適用する
- `max_results` 到達後は追加の結果収集を行わない

## 7. フィルタ設計

- フィルタ基準はすべて `workspaceRoot` 起点の相対パスに統一する
- 探索対象は `root_path` 配下に限定する
- デフォルト除外を先に適用する
- `include` は残った探索可能パス集合に対する allowlist として扱う
- `exclude` は常に最優先で適用し、`include` と同時一致しても除外する
- パス区切りは入力時に `\\` を `/` へ正規化し、glob 評価と出力パスを `/` 統一で扱う

## 8. 実装分割（モジュール責務）

- `src/tools/search/ast_grep_search/types.ts`
  - Input / Output / raw match 型 / error code を定義する
- `src/tools/search/ast_grep_search/validator.ts`
  - 入力制約、glob、serializable rule、数値範囲を検証する
- `src/tools/search/ast_grep_search/adapter.ts`
  - 一時 rule file 生成、`sg` 実行、stdout parse、stderr 解析、エラー正規化を担当する
- `src/tools/search/ast_grep_search/usecase.ts`
  - root_path 検証、filter 適用、件数制御、安定ソート、warnings 集約を担当する
- `src/tools/search/ast_grep_search/tool.ts`
  - validator 呼び出し、usecase 実行、最終エラー正規化を担当する
- `src/registory/definitions.ts` / `src/lib.ts` / `src/toolkit/invoke/index.ts`
  - tool 定義、catalog、invoke 型と resolver を追加する
- `test/tools/search/ast_grep_search/tool.test.ts`
  - 正常系、入力不正、依存欠落、rule 不正、language 不正、timeout を検証する
- `test/tools/search/ast_grep_search/usecase.test.ts`
  - sort、glob 優先順位、path 正規化、max_results 打ち切りを検証する
- `test/registory/definitions.test.ts` / `test/lib.test.ts` / `test/registory/invoke.test.ts` / `test/typecheck/invoke-typing.ts`
  - 登録と型経路の整合を検証する

## 9. 将来拡張

- `@ast-grep/napi` adapter を追加し、`sg` 非依存モードをサポートする
- raw JSON に加えて正規化出力モードを追加する
- `search_with_context` と連携し、AST hit の前後文脈を取得できるようにする
- `symbol_usage` や `find_function_definition` の AST 基盤として再利用する
- 複数 rule の一括実行や lint rule config のサポートを追加する

## 10. Open Questions

現時点ではなし。
`sg` の stderr 文言差異だけは実装時に fixture を追加し、`INVALID_RULE` と `UNSUPPORTED_LANGUAGE` の分類条件を固定する。

## 11. 受け入れ基準（Definition of Done）

- `typescript` `javascript` `python` `go` `rust` の fixture で各 1 件以上の一致を返せる
- `language=""` は `INVALID_ARGUMENT` を返す
- `rule` に配列や null を渡すと `INVALID_ARGUMENT` を返す
- 不正 rule で `INVALID_RULE` を返す
- 不正 language で `UNSUPPORTED_LANGUAGE` を返す
- `sg` が存在しない環境で `DEPENDENCY_MISSING` を返す
- `include` と `exclude` が同時一致するパスは結果に含まれない
- 出力 `items` が `file` と `range` の昇順で安定している
- `max_results=1` かつ 2 件以上一致する入力で `truncated=true` を返す
- Windows 区切り入力（例: `root_path="src\\tools"`）でも同じ結果集合を返す
- `TOOL_DEFINITIONS.ast_grep_search` が本仕様 4.4 と完全一致する
- `test/tools/search/ast_grep_search/*.test.ts` が pass する
- `scripts/sanity.sh` が成功する
