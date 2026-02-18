# Feature Spec: `codebase_search`

## 1. 目的

`codebase_search` は、自然言語または短いキーワード入力に対して、リポジトリ内の関連コード断片を高い再現率で返す検索機能である。
本機能は `find_function_definition` / `symbol_usage` / `search_with_context` など後続機能のベースとなるため、まずは「安定して見つかる」「結果の根拠が説明できる」ことを優先する。

## 2. ユースケース

- API ハンドラ実装箇所を「認証」などの意味検索で探したい
- 関連するユーティリティ関数群を横断的に把握したい
- 実装変更前に、近い責務の既存コードを短時間で収集したい
- テスト追加時に、同系統のテスト実装を探したい

## 3. 要求仕様（機能要件）

### 3.1 MUST

- クエリ文字列を受け取り、関連するコードチャンクを上位 `top_k` 件返す
- 各結果に `path` / `start_line` / `end_line` / `score` / `snippet` を含める
- `include` / `exclude` によるパス絞り込みができる
- 拡張子または言語による絞り込みができる
- バイナリファイル・巨大ファイルをインデックス対象外にできる
- タイムアウト時に部分結果または明示的エラーを返す

### 3.2 SHOULD

- クエリと結果の一致根拠を短文で返す（例: ヒット語、類似概念）
- 同一ファイル結果を過剰に返さないように分散制御を行う
- 結果件数 0 の場合に、検索条件の緩和提案を返す

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type CodebaseSearchInput = {
  query: string; // 必須
  top_k?: number; // default: 10, max: 50
  include?: string[]; // glob
  exclude?: string[]; // glob
  languages?: string[]; // 例: ["ts", "tsx"]
  min_score?: number; // 0.0 - 1.0
  offset?: number; // pagination 用
  timeout_ms?: number; // default: 5000
};
```

### 4.2 Output

```ts
type CodebaseSearchOutput = {
  query: string;
  took_ms: number;
  total_hits: number;
  items: Array<{
    path: string;
    start_line: number;
    end_line: number;
    score: number;
    snippet: string;
    reason?: string; // 任意: スコア根拠
  }>;
  warnings?: string[];
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: `query` 空文字、`top_k` 範囲外など
- `TIMEOUT`: `timeout_ms` 超過
- `INDEX_NOT_READY`: 初期インデックス未構築
- `INTERNAL`: 想定外エラー

## 5. 検索/判定モデル設計

### 5.1 インデックス単位

- 基本単位は「コードチャンク」
- 1チャンクは行ベースで分割（目安 80-200 行）
- 関数境界・クラス境界を優先して分割し、過分割を避ける

### 5.2 保存情報

- `path`, `start_line`, `end_line`, `language`
- プレーンテキスト
- 正規化済みトークン
- ベクトル埋め込み（セマンティック検索用）

### 5.3 更新方式

- 初回: 全量インデックス構築
- 以降: ファイル更新時に対象ファイルのみ再チャンク・再登録
- 削除ファイル: インデックスから削除

## 6. ランキング/優先順位設計

### 6.1 スコア統合

- `final_score = w_semantic * semantic + w_lexical * lexical + w_path * path_boost`
- 初期重み案: `w_semantic=0.6`, `w_lexical=0.3`, `w_path=0.1`

### 6.2 再ランク

- 上位 N 件に対して近傍重複を抑制（同一/近接チャンクの重複排除）
- 同一ファイルの最大件数を制限し、探索多様性を確保

### 6.3 閾値

- `min_score` 未満の結果は除外
- 除外後 `items=0` の場合は `warnings` にガイダンスを付与

## 7. フィルタ設計

- `include` は許可パターン（未指定なら全体）
- `exclude` は拒否パターン（常に優先）
- デフォルト除外:
  - `.git/**`
  - `node_modules/**`
  - `dist/**`, `build/**`
  - ロックファイル、バイナリ拡張子
- `languages` 指定時は拡張子マップで前処理フィルタを行う

## 8. 実装分割（モジュール責務）

- `src/tools/search/codebase_search/tool.ts`
  - 入力検証、ユースケース呼び出し、出力整形
- `src/tools/search/codebase_search/usecase.ts`
  - 検索フロー制御（取得、フィルタ、ランキング、整形）
- `src/tools/search/codebase_search/index_repository.ts`
  - インデックス読み書き抽象
- `src/tools/search/codebase_search/chunker.ts`
  - ファイルをチャンクへ分割
- `src/tools/search/codebase_search/ranker.ts`
  - スコア統合、重複排除、再ランク
- `src/tools/search/codebase_search/path_filter.ts`
  - include/exclude/language フィルタ
- `test/tools/search/codebase_search/*.test.ts`
  - 入力検証、検索品質、境界条件を検証

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| 埋め込みモデルを何で固定するか（ローカル実行/外部API） | 代表クエリセットで Recall@10 とレイテンシを計測し、SLO と運用制約（オフライン可否）で採択する |
| インデックス保存先をどこに置くか（メモリ/ローカルDB） | リポジトリ規模別に起動時間・検索時間・メモリ使用量を比較し、既定値を決める |
| `snippet` の最大長とトークン上限をどう定義するか | 呼び出し側の表示要件とトークンコストを基準に A/B で上限値を決める |
| 多言語リポジトリでの言語判定精度をどう担保するか | 拡張子ベース + コンテンツ推定の一致率をサンプル計測し、閾値未満なら言語別ルールを追加する |
| スコアの絶対値をユーザーに公開するか、順位のみ公開するか | ユーザー調査で理解しやすさを確認し、誤解が多ければ順位中心に切り替える |

## 11. 受け入れ基準（Definition of Done）

- `query` に対して再現可能な結果が返る（同一入力で順序が安定）
- `include` / `exclude` / `languages` が期待どおりに効く
- `top_k`, `min_score`, `timeout_ms` の境界値テストが通る
- 空リポジトリ・巨大ファイル混在時に安全に終了する
- 主要ユースケースで手動検証し、明らかなノイズ上位ヒットがない
- `bun test` が成功する
