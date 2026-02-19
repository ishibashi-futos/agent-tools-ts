# Feature Spec Template: `tool_name`

このテンプレートは、ツール仕様を最小コストで揃えるための雛形です。
`tool_name` を対象機能名に置き換えて使用してください。

## 1. 目的

### 何を書くか

- この機能が解決する課題
- この機能が「他機能のどこに効くか」
- 初期版で最優先する価値（速度 / 精度 / 安定性 など）

### 記入ガイド

- 2-5 行で簡潔に書く
- 実装方針ではなく「目的」を書く

## 2. ユースケース

### 何を書くか

- 実際の利用シナリオを 3-6 個
- ユーザー行動 + 期待結果の形で書く

### 記入ガイド

- 1ユースケースは 1 行で表現する
- 「誰が/何を/なぜ」を含める

## 3. 要求仕様（機能要件）

### 3.1 MUST

- 初期版で必須の要件を書く

### 3.2 SHOULD

- できれば欲しいが、初期版で妥協可能な要件を書く

### 3.3 WON'T（初期版では非対応）

- 明示的にやらないことを書く

### 記入ガイド

- MUST/SHOULD/WON'T を混ぜない
- 各項目はテスト可能な文にする（曖昧語を避ける）

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type ToolNameInput = {
  // 必須/任意、default、上限/下限をコメントで明記
};
```

### 4.2 Output

```ts
type ToolNameOutput = {
  // 呼び出し側が使う最小情報を定義
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: 入力不正
- `TIMEOUT`: タイムアウト
- `INTERNAL`: 想定外エラー
- 必要なら機能固有エラーを追加

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.<tool_name>` に記載する文言を定義する。

```ts
const TOOL_NAME_DEFINITION = {
  name: "tool_name",
  description: "Short, clear English description.",
  parameters: {
    type: "object",
    properties: {
      input_a: {
        type: "string",
        description: "What this parameter means.",
      },
      input_b: {
        type: "number",
        default: 10,
        description: "Limit value (default: 10).",
      },
    },
    required: ["input_a"],
  },
} as const;
```

- `description` はトークン節約のため短く保ちつつ、機能の意味が 1 文で伝わる英語にする
- `properties` で default がある項目は `default` フィールドを定義し、`description` にも `(default: X)` を明記する
- 文言は仕様書と実装で完全一致させる

### 記入ガイド

- I/O は TypeScript の型で固定する
- 返却フィールドは利用用途が説明できるものだけに絞る
- Tool definition の文言（`description`/`parameters`）も仕様で固定する

## 5. 検索/判定モデル設計（必要な場合）

### 何を書くか

- インデックス単位・解析単位
- 前処理、保存情報、更新方式

### 記入ガイド

- 機能が検索系でない場合は、この章名を適切に変更してよい
- 初期版は「唯一の正解」になる単純設計を優先する

## 6. ランキング/優先順位設計（必要な場合）

### 何を書くか

- スコア算出式や優先順位ルール
- 重複排除、しきい値、安定ソート条件

### 記入ガイド

- ルールは再現可能に書く（同一入力で同一出力順）
- 将来調整する定数は初期値を明記する

## 7. フィルタ設計

### 何を書くか

- include/exclude 条件
- デフォルト除外条件
- 言語・拡張子などの前処理フィルタ

### 記入ガイド

- 優先順位を明記する（例: exclude 優先）
- 大規模リポジトリ前提で、ノイズ除去を先に定義する

## 8. 実装分割（モジュール責務）

### 何を書くか

- 主要ファイルごとの責務
- 依存関係の向き（どこからどこを呼ぶか）
- テスト配置

### 記入ガイド

- 1ファイル1責務を基本にする
- `tool.ts`（I/O）と `usecase.ts`（業務ロジック）は分離する

## 9. 将来拡張

### 何を書くか

- この機能を土台にした派生機能
- 追加予定の品質改善（再ランク、評価基盤など）

### 記入ガイド

- 依存先機能との接続点を明確に書く
- 初期版のスコープを壊さない範囲で列挙する

## 10. Open Questions

### 何を書くか

- 現時点で未決の設計判断
- 決定に必要な情報・実験項目

### 記入ガイド

- 「何が未決か」だけでなく「どう決めるか」まで書く
- 未決事項は担当と期限を別ドキュメントで管理してもよい

## 11. 受け入れ基準（Definition of Done）

### 何を書くか

- 実装完了判定条件
- テスト完了条件
- 非機能上の完了条件（安定性、再現性など）

### 記入ガイド

- 各項目は pass/fail を判定できる文にする
- 最後に `bun test` 成功を含める

## 最小チェックリスト

- [ ] 目的が 5 行以内で明確
- [ ] MUST/SHOULD/WON'T が分離されている
- [ ] Input/Output/Error が型で定義されている
- [ ] Tool Definition Metadata（description/parameters/default）が定義されている
- [ ] 実装分割に `tool.ts` と `usecase.ts` がある
- [ ] Open Questions が意思決定可能な粒度
- [ ] DoD がテスト可能
