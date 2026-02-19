# Feature Spec: `get_allowed_tools`

優先度: P0

## 1. 目的

`createAgentToolkit` から、現在の policy で実行許可されるツールのみを `Tool[]`（`src/registory/types.ts`）として取得できるようにする。
これにより、実行許可されていないツールをモデルに提示しない安全な tool 提供を行う。
初期版は「allow/deny のみ」を対象にし、単純で再現可能な抽出ロジックを採用する。

## 2. ユースケース

- エージェント実行前に、許可済みツールだけを LLM の `tools` 入力へ渡す
- `defaultPolicy: "deny"` 環境で、明示 `allow` したツールのみをモデルに提示する
- `defaultPolicy: "allow"` 環境で、明示 `deny` したツールを除外して提示する
- ポリシー変更時に tool 配列が自動で追従し、手動メンテを不要にする

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `createAgentToolkit(context)` の戻り値に `getAllowedTools()` を追加する
- `getAllowedTools()` は `TOOL_DEFINITIONS` を元に `context.policy` で `allow` 判定されたツールのみ返す
- 判定は `context.policy.tools[toolName] ?? context.policy.defaultPolicy` で行う
- 返却順は `TOOL_DEFINITIONS` の定義順を維持する
- 返却型は `Tool[]`（`src/registory/types.ts`）とする

### 3.2 SHOULD

- ツール抽出処理を純関数として分離し、`lib.ts` から再利用する
- 空配列返却時も例外にせず、呼び出し側で安全に扱える戻り値を維持する

### 3.3 WON'T（初期版では非対応）

- モデル名や API 種別ごとのツール出し分け
- write/read 種別による追加フィルタ
- ツールごとの動的 description 変更

## 4. 入出力仕様（Tool I/O）

この機能は toolkit の補助関数追加であり、独立した tool 入出力は存在しない。

## 5. 判定モデル設計

- 入力: `TOOL_DEFINITIONS`（全ツール定義）と `SecurityPolicyConfig`
- 手順: `Object.entries(TOOL_DEFINITIONS)` を順走査し、tool 名ごとに policy を解決
- 判定: 解決結果が `allow` の場合のみ返却対象に含める
- 出力: `Tool[]`

## 6. ランキング/優先順位設計

- 初期版では非適用（順位付けしないため）

## 7. フィルタ設計

- 優先順位は `tools[toolName]` の明示設定を最優先し、未指定時のみ `defaultPolicy` を適用する
- `allow` は包含、`deny` は除外の 2 値のみ
- policy に存在しない未知キーは無視する

## 8. 実装分割（モジュール責務）

- `src/registory/types.ts`
  - `Tool` 型を定義（既存を利用）
- `src/registory/definitions.ts`
  - `TOOL_DEFINITIONS` 本体（既存を利用）
- `src/registory/select.ts`
  - `selectAllowedTools(definitions, policy)` を実装
- `src/lib.ts`
  - `createAgentToolkit(context).getAllowedTools()` を追加し `selectAllowedTools` を呼び出す
- `test/registory/select.test.ts`
  - policy 判定ロジックの単体テスト
- `test/lib.test.ts`
  - toolkit 経由で `getAllowedTools()` が期待どおり返る統合テスト

既存責務との衝突回避方針:
- `SecurityPolicy.authorize` は実行時チェック専用として維持し、列挙用途に流用しない
- 抽出ロジックは副作用なしの専用関数に分離する

## 9. 将来拡張

- `ToolContext` の型補完改善と連携し、`tools` 設定時に tool 名の入力補完を提供する
- `responses` API 向けの tools 形式が必要になった場合、同一選別ロジックを再利用する
- 環境情報（OS/ランタイム）に基づく tool 露出制御を追加できる拡張点にする

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| `getAllowedTools` を `createAgentToolkit` 戻り値へ追加するか、トップレベル関数で公開するか | 利用側の呼び出し頻度と API 一貫性を比較し、既存利用コード 2 パターンでレビューして決定する |

## 11. 受け入れ基準（Definition of Done）

- `createAgentToolkit(context)` の戻り値に `getAllowedTools()` が追加されている
- `defaultPolicy: "deny"` かつ `tools: { read_file: "allow" }` で `read_file` のみ返る
- `defaultPolicy: "allow"` かつ `tools: { exec_command: "deny" }` で `exec_command` が除外される
- 返却配列の各要素が `Tool` に適合する
- `bun test` が成功する

未確定事項サマリ:
- API 露出位置（toolkit メソッド追加かトップレベル関数か）が未決。
- 判定ロジックと型設計は確定。
- 未決事項は利用コード比較レビューで確定する。
