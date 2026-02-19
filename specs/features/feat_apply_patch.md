# Feature Spec: `apply_patch`

優先度: 未確定（`specs/backlog.md` に優先度記載なし）

## 1. 目的

`apply_patch` は、ワークスペース内ファイルに unified diff を適用し、エージェントが最小差分で安全に編集できるようにする基盤ツールである。
本機能は `read_file` で取得した内容の更新、`exec_command` 実行前後のコード修正、レビュー修正の自動反映に直結する。
初期版は「確実性と再現性」を最優先し、単一ファイルへの差分適用と失敗検知をシンプルに提供する。

## 2. ユースケース

- エージェントが `read_file` で確認した TypeScript ファイルに対し、関数の一部だけを unified diff で更新する
- 開発者がレビュー指摘修正をエージェントに依頼し、既存コードを最小変更で書き換える
- エージェントが `exec_command` でテスト失敗を確認した後、該当ファイルへ修正パッチを適用する
- 開発者が大きなファイル誤編集を避けるため、10MB 以下の対象に限定して差分適用する
- エージェントが `git apply` 非ゼロ終了でも内容更新を検知し、実質成功として後続処理を継続する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `filePath` と `patch`（unified diff 文字列）を受け取り、対象ファイルへ 1 回だけ適用処理を行う
- `filePath` は `createSecureTool` によるワークスペース内正規化を前提とし、外部パスは拒否される
- `filePath` が存在しない場合は `NOT_FOUND` を返す
- 対象ファイルサイズが 10MB を超える場合は `FILE_TOO_LARGE` を返す
- パッチ適用は `git apply --whitespace=fix --include <filePath> -` で実行する
- 適用前後のファイル内容ハッシュを比較し、`git apply` が非ゼロ終了かつ内容不変のときのみ `APPLY_FAILED` を返す
- `patch` は文字列のみ受け付け、非文字列は `INVALID_ARGUMENT` を返す
- 想定外例外は `INTERNAL` に正規化して返す

### 3.2 SHOULD

- 失敗メッセージに終了コードと `stderr` 要約を含め、再実行可否を判断しやすくする
- 適用前提チェック（存在確認・サイズ確認）を `git apply` 実行前に完了し、無駄な子プロセス起動を避ける
- テストでは `spawn` と `hasher` を注入可能にし、正常系と異常系を決定的に検証できるようにする

### 3.3 WON'T（初期版では非対応）

- 複数ファイル同時適用
- 3-way merge や競合解決の自動化
- パッチ構文の事前静的解析と自動補正
- バイナリファイルへの差分適用

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type ApplyPatchInput = {
  filePath: string; // 必須。workspace 内の対象ファイルパス。空文字不可
  patch: string; // 必須。unified diff 文字列
};
```

### 4.2 Output

```ts
type ApplyPatchOutput = void; // 正常終了時は値を返さない
```

### 4.3 Error

- `INVALID_ARGUMENT`: `filePath` が空/非文字列、`patch` が非文字列
- `NOT_FOUND`: `filePath` が存在しない
- `FILE_TOO_LARGE`: 対象ファイルサイズが 10MB 超
- `APPLY_FAILED`: `git apply` 非ゼロ終了かつ適用前後で内容ハッシュ不変
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.apply_patch` には次の文言を固定で使う。

```ts
const APPLY_PATCH_TOOL_DEFINITION = {
  name: "apply_patch",
  description:
    "Applies a unified diff patch to a file. Best for making precise code changes.",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Target file path",
      },
      patch: {
        type: "string",
        description: "Unified diff content",
      },
    },
    required: ["filePath", "patch"],
  },
} as const;
```

## 5. 適用モデル設計

- 実行単位は「1 リクエスト = 1 ファイル適用」とする
- 処理順は `入力検証 -> ファイル存在/サイズ確認 -> 適用前ハッシュ取得 -> git apply 実行 -> 適用後ハッシュ取得 -> 成否判定` の固定順とする
- 成否判定は `exitCode===0` を成功、`exitCode!==0 && hash変更あり` を実質成功、`exitCode!==0 && hash不変` を失敗とする
- ハッシュは SHA-256（16進文字列）を使用し、改行や空白正規化は行わない
- `ToolContext` は実行本体で利用せず、セキュリティ境界は `createSecureTool` 側に委譲する

## 6. ランキング/優先順位設計

- 初期版では非適用（検索・候補順位付け機能ではないため）
- 同一入力時の動作は固定フローにより決定的にする

## 7. フィルタ設計

- 実行可否の優先順位は `policy 判定 -> sandbox write 判定 -> path 正規化 -> apply_patch 実行` とする
- 入力フィルタは `filePath` 非空文字列判定と `patch` 文字列判定のみを行う
- 対象ファイルフィルタは `exists=true` かつ `size <= 10MB` を必須条件とする
- `git apply` の対象は `--include <filePath>` で単一ファイルに限定する

## 8. 実装分割（モジュール責務）

- `src/tools/edit/apply_patch/tool.ts`
  - Tool I/O、入力検証呼び出し、usecase 実行、エラー正規化を担当
- `src/tools/edit/apply_patch/validator.ts`
  - `filePath` / `patch` の型・必須チェックを担当
- `src/tools/edit/apply_patch/usecase.ts`
  - ファイル存在/サイズ確認、ハッシュ比較、`git apply` 実行、成否判定を担当
- `src/tools/edit/apply_patch/error.ts`
  - `ApplyPatchError` と `toInternalError` を担当
- `src/tools/edit/apply_patch/types.ts`
  - 入力型、エラーコード型、依存注入型を担当
- `src/lib.ts`
  - `ToolCatalog.apply_patch` と `createAgentToolkit().applyPatch` の公開を担当
- `src/registory/definitions.ts`
  - `apply_patch` の tool definition 文言を保持する
- `test/tools/edit/apply_patch/tool.test.ts`
  - NOT_FOUND、FILE_TOO_LARGE、APPLY_FAILED、実質成功、成功系を検証する

既存実装は上記責務で既に分割済みのため、追加実装では責務重複を避ける。`git apply` 呼び出しロジックは `usecase.ts` に集約し、`tool.ts` 側で再実装しない。

## 9. 将来拡張

- `read_file` 連携: `read_file` の結果を入力コンテキストとして、差分生成から `apply_patch` 適用までを一連化する
- `exec_command` 連携: `apply_patch` 後に `bun test` などを即時実行する修正ループを標準フロー化する
- `tree` 連携: `tree` で選択した候補ファイル群に対する逐次パッチ適用バッチ（1ファイルずつ）を追加する
- `git_diff`（将来）連携: 適用前後の差分検証をツール間で共通化し、適用結果の監査可能性を高める

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| 優先度（P0-P4）をどこに設定するか（現状 backlog 未記載） | プロダクトバックログ整備時に `edit` ドメイン他機能（`read_file` など）との依存関係を比較し、週次プランニングで決定する |
| `APPLY_FAILED` 発生時に `stderr` 全文を返すか、長さ制限を設けるか | 実運用ログサイズを 1 週間計測し、中央値/95 パーセンタイルで上限値（必要なら `max_error_chars`）を決定する |
| 10MB 固定上限を設定値化するか | 実際の適用対象ファイルサイズ分布を収集し、上限超過率が閾値（例: 5%）を超える場合に設定化を検討する |

## 11. 受け入れ基準（Definition of Done）

- `filePath` が存在しない場合、`createApplyPatch` は `NOT_FOUND` を返し `spawn` を呼ばない
- 10MB 超ファイルを指定した場合、`FILE_TOO_LARGE` を返し `spawn` を呼ばない
- `git apply` が `exitCode=1` かつ前後ハッシュ不変のとき、`APPLY_FAILED` を返す
- `git apply` が `exitCode=1` でも前後ハッシュ変化ありのとき、エラーを返さず正常終了する
- `git apply` が `exitCode=0` のとき、正常終了する
- `TOOL_DEFINITIONS.apply_patch.description` と parameter 文言が本仕様 4.4 と完全一致する
- `test/tools/edit/apply_patch/tool.test.ts` が pass する
- `bun test` が成功する

未確定事項サマリ:
- 優先度（P0-P4）が backlog 上で未定義。
- `APPLY_FAILED` の `stderr` 返却量ポリシーが未定。
- 10MB 上限の設定値化要否が未定。
