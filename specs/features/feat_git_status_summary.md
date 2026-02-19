# Feature Spec: `git_status_summary`

優先度: P0

## 1. 目的

`git_status_summary` は、ワークスペース内 Git リポジトリのワークツリー状態を、機械可読な最小サマリとして取得するためのツールである。
エージェントが編集後に「現在ブランチ」と「状態の生テキスト」を即時取得できるようにする。
初期版は「シンプルで唯一の正解」を優先し、`git -c core.quotePath=false status --porcelain=v1 --branch` の生出力をそのまま返す。

## 2. ユースケース

- エージェントが `apply_patch` 実行後に `raw` を参照し、変更有無を判定する
- 開発者が現在ブランチ名を確認し、誤ブランチ作業を防ぐ
- CI 補助ツールが `raw` をログとして保存し、トラブル時に再解析する
- 将来の `git_diff` 連携で `raw` を入力として差分取得対象を決める
- ツール実装者が `raw` を使って独自の集計ロジックを上位層で実装する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `cwd`（任意）を受け取り、未指定時は `context.workspaceRoot` を用いて Git ワークツリー状態を 1 回取得する
- `cwd` は `/` と `\\` のどちらの区切りでも受け付け、実行前に OS 非依存の正規化を行う
- `cwd` は workspace 相対パスのみを許可し、Windows ドライブレター付き絶対パス（例: `C:\\work`）を拒否する
- 取得コマンドは `git -c core.quotePath=false status --porcelain=v1 --branch` に固定する
- 出力は `repository_root` / `branch` / `raw` を返す
- `branch` は先頭 `##` 行から抽出し、detached HEAD の場合は `null` を返す
- `repository_root` は `git rev-parse --show-toplevel` の標準出力（trim 後）を返す
- `raw` は `git -c core.quotePath=false status --porcelain=v1 --branch` の標準出力を改変せず返す
- `cwd` が Git リポジトリ外の場合は専用エラー `NOT_GIT_REPOSITORY` を返す
- 同一入力に対して同一 `git status` 出力が得られる場合、同一の構造化結果を返す
- 例外は `INTERNAL` として返す

### 3.2 SHOULD

- `raw` は末尾改行を含め、Git 標準出力との一致を維持する
- `branch` 抽出に失敗した場合でも `raw` は返却し、原因解析を可能にする

### 3.3 WON'T（初期版では非対応）

- `git status` 以外のコマンド（`git diff` / `git ls-files`）との複合サマリ生成
- サブモジュール状態の詳細解析
- `.gitignore` で無視されたファイル一覧の返却
- 再帰的な複数リポジトリ一括集計
- porcelain v2 形式のサポート
- entries や件数（staged/unstaged/untracked/conflicted）の構造化返却

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type GitStatusSummaryInput = {
  cwd?: string; // 任意。default: workspaceRoot。workspace 内ディレクトリ
};
```

### 4.2 Output

```ts
type GitStatusSummaryOutput = {
  repository_root: string; // 対象 Git リポジトリの絶対ルートパス
  branch: string | null; // detached HEAD の場合は null
  raw: string; // git -c core.quotePath=false status --porcelain=v1 --branch の生出力
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: `cwd` が空文字、または文字列でない
- `NOT_DIRECTORY`: `cwd` が存在しない、またはディレクトリでない
- `NOT_GIT_REPOSITORY`: `cwd` が Git 管理外、または `.git` 解決不能
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.git_status_summary` には次の文言を固定で使う。

```ts
const GIT_STATUS_SUMMARY_TOOL_DEFINITION = {
  name: "git_status_summary",
  description: "Returns current git branch and raw porcelain status output for a workspace directory.",
  parameters: {
    type: "object",
    properties: {
      cwd: {
        type: "string",
        default: ".",
        description:
          "Workspace path to inspect (default: workspace root). Accepts / or \\\\ as separator; escape backslash in JSON (e.g. src\\\\tools).",
      },
    },
    required: [],
  },
} as const;
```

## 5. 実行モデル設計

- 実行単位は「1 リクエスト = 2 回の Git コマンド実行（`rev-parse` と `status`）」とする
- フローは `入力検証 -> cwd ディレクトリ検証 -> rev-parse 実行 -> status 実行 -> branch 抽出 -> 返却` の固定順とする
- コマンド実行は `src/tools/exec/exec_command/tool.ts` の `execCommand` を利用し、実行基盤を重複実装しない
- 実行時引数は `rev-parse` を `command=["git", "rev-parse", "--show-toplevel"]`、`status` を `command=["git", "-c", "core.quotePath=false", "status", "--porcelain=v1", "--branch"]` とし、両方とも `shell_mode="direct"`、`timeout_ms=30000` を固定する
- `rev-parse` または `status` が `exit_code !== 0` かつ `stderr` に `not a git repository` を含む場合は `NOT_GIT_REPOSITORY` と判定する
- porcelain 先頭の `##` 行のみを解釈対象とし、それ以外は `raw` として保持する
- `cwd` は正規化後に `exec_command` へ渡し、OS 差異による区切り文字の違いを `git_status_summary` 内で吸収する
- `cwd` 未指定時は `context.workspaceRoot` を使用し、`rev-parse` の結果を `repository_root` に設定する
- quoted path（例: `"dir\\343\\201\\202.txt"`）は非デコードで `raw` に保持する
- `##` 行の抽出に失敗した場合は `branch=null` とし、`raw` は返却する

## 6. ランキング/優先順位設計

- 初期版では非適用（検索や順位付け機能ではないため）
- 出力は単一結果固定であり、順位付けは存在しない

## 7. フィルタ設計

- 判定優先順位は `入力検証 -> ディレクトリ検証 -> Git リポジトリ判定 -> porcelain 行解析` とする
- `raw` の再エスケープ/区切り文字変換は行わず、Git 出力を保持する
- `branch` 抽出は先頭 `##` 行のみを対象にし、他行はフィルタしない

## 8. 実装分割（モジュール責務）

- `src/tools/git/git_status_summary/tool.ts`
  - `GitStatusSummaryInput` の受け取り、validator/usecase 呼び出し、エラーマッピング
- `src/tools/git/git_status_summary/types.ts`
  - Input/Output/ErrorCode 型定義
- `src/tools/git/git_status_summary/validator.ts`
  - `cwd` の入力検証
- `src/tools/git/git_status_summary/usecase.ts`
  - `execCommand` 呼び出し、非ゼロ終了ハンドリング、`branch`/`raw` の組み立て
- `src/tools/git/git_status_summary/parse_branch.ts`
  - `--porcelain=v1 --branch` の先頭 `##` 行から branch 名を抽出
- `src/tools/git/git_status_summary/error.ts`
  - `GitStatusSummaryError` と `toInternalError` の定義
- `src/lib.ts`
  - `ToolCatalog.git_status_summary` と `createAgentToolkit().gitStatusSummary` の公開
- `src/registory/definitions.ts`
  - `git_status_summary` の tool definition 追加
- `test/tools/git/git_status_summary/tool.test.ts`
  - 正常系、`NOT_DIRECTORY`、`NOT_GIT_REPOSITORY`、`cwd` 既定値の検証
- `test/tools/git/git_status_summary/parse_branch.test.ts`
  - branch 行、detached HEAD、`##` 行欠落時（`null`）の検証

既存 `exec_command` とは責務を分離し、コマンド実行・タイムアウト制御は `exec_command` 側を再利用する。`git_status_summary` は Git 固有の判定・整形だけを担当し、プロセス実行ロジックを持たない。

## 9. 将来拡張

- `git_diff` 連携: `raw` を解析して変更パスを抽出し、差分本文取得に接続する
- `git_log` 連携: `branch` を起点に履歴要約対象を決定する
- `tree` 連携: `raw` 解析結果をツリーノード表示へ重畳する
- `apply_patch` 連携: 適用前後の `raw` を比較し、変更発生有無を検証する

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |

## 11. 受け入れ基準（Definition of Done）

- `cwd` に Git リポジトリ配下パスを渡すと `repository_root` / `branch` / `raw` が返る
- `repository_root` が `git rev-parse --show-toplevel` の標準出力（trim 後）と一致する
- `raw` が `git -c core.quotePath=false status --porcelain=v1 --branch` の標準出力と一致する
- detached HEAD 状態では `branch=null` を返す
- `cwd` が存在しない、またはファイルパスの場合は `NOT_DIRECTORY` を返す
- `cwd` 未指定で呼び出した場合、`workspaceRoot` を対象に状態取得できる
- `cwd=\"src/tools\"` と `cwd=\"src\\\\tools\"` の双方で同一ディレクトリが解決される
- `cwd` が Git 管理外の場合は `NOT_GIT_REPOSITORY` を返す
- quoted path を含む porcelain 出力が `raw` で保持される
- `workspaceRoot` 配下の内側 repo を cwd にした場合、repository_root は内側 repo のルートになる
- `ToolCatalog` と `TOOL_DEFINITIONS` に `git_status_summary` が登録される
- `TOOL_DEFINITIONS.git_status_summary.description` と parameter description が本仕様 `4.4` と完全一致する
- `test/tools/git/git_status_summary/tool.test.ts` と `test/tools/git/git_status_summary/parse_branch.test.ts` の主要ケースが pass する
- `bun test` が成功する

未確定事項サマリ:
- なし
