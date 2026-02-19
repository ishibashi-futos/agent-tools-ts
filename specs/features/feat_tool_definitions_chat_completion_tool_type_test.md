# Feature Spec: `tool_definitions_chat_completion_tool_type_test`

優先度: P0

## 1. 目的

`TOOL_DEFINITIONS` が OpenAI 互換の `ChatCompletionTool[]` として利用可能であることを、テストで継続的に保証する。
将来ツール追加時に `parameters` 形状や `type` の不整合を早期検知し、実行時エラーを防ぐ。
初期版は実行時検証ではなく、TypeScript のコンパイル時検証を唯一の正解として採用する。

## 2. ユースケース

- ツール実装者が `TOOL_DEFINITIONS` に新規定義を追加した際、型不一致を CI で即座に検知する
- API 連携実装者が `Object.values(TOOL_DEFINITIONS)` を Chat Completions の `tools` に安全に渡す
- レビュアーが「OpenAI 仕様への適合」をテスト結果で機械的に確認する
- 保守担当者が description や parameters 更新時に破壊的変更をコンパイルエラーで検出する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `TOOL_DEFINITIONS` 全体を `ChatCompletionTool[]` として代入可能であることを検証する型テストを追加する
- 型テストは `ChatCompletionTool` が要求する最小構造（`type: "function"` と `function.name/description/parameters`）を満たさない場合に fail する
- `ChatCompletionTool` の型は `openai` パッケージ（`^6.22.0`）から import する
- 検証対象は `src/registory/definitions.ts` の実定義を直接参照し、重複したダミー定義を作らない
- `bun run typecheck` で fail/pass が判定できるようにする
- 既存の `bun test` 実行フローを壊さない

### 3.2 SHOULD

- 型テストは単一ファイルに集約し、将来ツール追加時の追記箇所を最小化する
- テストコード内で `TOOL_DEFINITIONS` を配列化するヘルパーを定義し、利用側コードと同じ変換手順を明示する
- 型テストの配置は `test/registory/definitions.test.ts` に統一する

### 3.3 WON'T（初期版では非対応）

- OpenAI API への実ネットワークリクエストによる統合テスト
- Zod/AJV など追加バリデータ導入による runtime schema 検証
- `responses` API など別 API 形式の同時保証

## 4. 入出力仕様（Tool I/O）

この機能はテストであり、入出力は存在しない

## 5. 検証モデル設計

- 検証単位は「`Object.values(TOOL_DEFINITIONS)` を `ChatCompletionTool[]` へ代入する 1 アサーション」とする
- 検証方式は TypeScript コンパイル時の静的検証のみとする
- `ChatCompletionTool` は `openai` パッケージから import し、ローカル互換型は定義しない
- 実装は `const tools: ChatCompletionTool[] = toChatCompletionTools(TOOL_DEFINITIONS)` または `satisfies` を使い、構造不一致を型エラー化する
- `TOOL_DEFINITIONS` 側で `type: "function"` を必須化し、OpenAI の tools 配列仕様に一致させる

## 6. ランキング/優先順位設計

- 初期版では非適用（検索・スコアリング機能ではないため）

## 7. フィルタ設計

- 初期版では非適用（フィルタリング処理を持たないため）
- 判定対象は `TOOL_DEFINITIONS` の全エントリ固定とし、部分除外は行わない

## 8. 実装分割（モジュール責務）

- `src/registory/definitions.ts`
  - `TOOL_DEFINITIONS` を `ChatCompletionTool[]` へ変換可能な形に保つ（必要なら `type: "function"` を各エントリへ追加）
- `src/lib.ts`
  - 既存 API との責務衝突を避け、公開インターフェースは変更しない
- `test/registory/definitions.test.ts`
  - `TOOL_DEFINITIONS` を直接 import し、`ChatCompletionTool[]` 代入可能性を静的検証する
- `tsconfig.json`
  - 型テストファイルが `bun run typecheck` 対象に含まれることを保証する

既存の `test/tools/**` 実行時テストとは責務を分離し、本仕様は「コンパイル時契約の検証」に限定する。

## 9. 将来拡張

- `toolKitから、OpenAIの ChatCompletionTool[] 相当の tools を取得できる関数` 追加時に、本型テストを回帰テストとして再利用する
- `ToolContext の Policy 入力補完` 改善時に、`TOOL_DEFINITIONS` の型情報を policy 側型へ伝搬する接続点として利用する
- 将来的に `responses` API 互換型を導入する場合、同テストファイルに API 別の型アサーションを追加する

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| なし | 初期版では追加の未決事項なし |

## 11. 受け入れ基準（Definition of Done）

- `test/registory/definitions.test.ts` が追加されている
- 型テストは `src/registory/definitions.ts` の `TOOL_DEFINITIONS` を直接参照している
- `TOOL_DEFINITIONS` のいずれか 1 エントリで `ChatCompletionTool` 非互換な変更を加えると `bun run typecheck` が fail する
- 互換な定義状態では `bun run typecheck` が pass する
- 既存 runtime テスト（`bun test`）が pass する
- 本仕様書と実装の責務分割が一致している

未確定事項サマリ:
- `ChatCompletionTool` の型参照元は `openai@^6.22.0` に確定。
- 型テスト配置は `test/registory/definitions.test.ts` に確定。
- 追加の未確定事項はなし。
