# Feature Spec: `tree`

優先度: P0

## 1. 目的

`tree` は、ワークスペース内のファイル/ディレクトリ構造を再現可能な順序で取得するための基盤ツールである。
本機能は `list_files` の基礎情報取得、`read_file` の対象探索、`codebase_search` の探索範囲確認に直結する。
初期版は「安全性と決定性」を最優先し、深さ制限付きの単純なツリー列挙に限定する。

## 2. ユースケース

- エージェントが修正対象候補を把握するために、リポジトリ直下の構造を確認する
- 開発者が `read_file` 実行前に、目的ファイルの存在場所を特定する
- CI 失敗時に、生成物混入の有無をディレクトリ単位で確認する
- `codebase_search` 前に、探索除外すべきディレクトリ（`node_modules` など）を確認する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `path` 配下を再帰走査し、`entry_kind="directory"` ではディレクトリのみ、`entry_kind="all"` ではファイル/ディレクトリ/シンボリックリンクをツリー構造で返す
- 既定値 `max_depth=3` で深さ制限を適用し、制限超過ノードは `truncated=true` として返す
- 既定値 `max_entries=100` で総ノード数を制限し、超過時は走査を停止して `limit_reached=true` を返す
- `entry_kind` の既定値は `"directory"` とし、ファイルを含めたい場合のみ `"all"` を明示指定させる
- 返却順序は「ディレクトリ優先、同種は名前昇順（UTF-16 コード単位比較）」で固定する
- 返却ノードの `path` は常に `workspaceRoot` 起点の相対パスで返し、絶対パスや入力 `path` 起点の相対パスは返さない
- `path` は `createSecureTool` によるワークスペース内正規化を前提とし、外部パスは拒否される
- `exclude` は glob パターンとして解釈し、一致したファイル/ディレクトリを除外する
- シンボリックリンクは展開せず、`kind="symlink"` としてノード情報のみ返す
- `include_hidden=false` の場合、`.` 始まりのファイル/ディレクトリを除外する
- 取得対象が存在しない、またはファイル指定時は規定エラーを返す

### 3.2 SHOULD

- 各ノードに `depth` と `path`（workspace 相対）を含め、呼び出し側が表示/再利用しやすい形式にする
- ルート集計として `total_dirs` / `total_files` / `total_symlinks` を返す
- デフォルト除外に `.git`, `node_modules`, `dist`, `build`, `target`, `.vscode`, `.DS_Store` を持つ

### 3.3 WON'T（初期版では非対応）

- ファイルサイズ、mtime、パーミッションなど詳細メタデータの返却
- シンボリックリンクの参照先解決および循環検出付き追跡
- gitignore 解釈
- ページネーション付き続き取得 API

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type TreeInput = {
  path: string; // 必須。workspace 内パス。ディレクトリのみ許可
  entry_kind?: "directory" | "all"; // default: "directory"
  max_depth?: number; // default: 3, min: 0, max: 12
  max_entries?: number; // default: 100, min: 1, max: 1000
  include_hidden?: boolean; // default: false
  exclude?: string[]; // 任意。workspace 相対パスに対する glob パターン
};
```

### 4.2 Output

```ts
type TreeNode = {
  name: string;
  path: string; // workspace root からの相対パス
  depth: number; // root=0
};

type TreeDirectoryNode = TreeNode & {
  kind: "directory";
  truncated?: boolean; // max_depth で子走査を打ち切ったディレクトリのみ true
  children?: TreeEntry[];
};

type TreeFileNode = TreeNode & {
  kind: "file";
};

type TreeSymlinkNode = TreeNode & {
  kind: "symlink";
};

type TreeEntry =
  | TreeDirectoryNode
  | TreeFileNode
  | TreeSymlinkNode;

type TreeOutput = {
  root: TreeDirectoryNode;
  limit_reached: boolean; // max_entries 到達で true
  scanned_entries: number; // 実際に走査したノード数
  total_dirs: number;
  total_files: number;
  total_symlinks: number;
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: `path` 空文字、`entry_kind` 不正値、`max_depth`/`max_entries` 範囲外、`exclude` 型不正、不正な glob パターン
- `NOT_FOUND`: 指定ディレクトリが存在しない
- `NOT_DIRECTORY`: `path` がファイルまたは特殊ファイル
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` の `TOOL_DEFINITIONS.tree` には次の文言を固定で使う。

```ts
const TREE_TOOL_DEFINITION = {
  name: "tree",
  description:
    "Returns a workspace tree: directories only or directories with files.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path in workspace." },
      entry_kind: {
        type: "string",
        enum: ["directory", "all"],
        default: "directory",
        description: "Node types to include (default: directory).",
      },
      max_depth: {
        type: "number",
        default: 3,
        description: "Maximum traversal depth (default: 3).",
      },
      max_entries: {
        type: "number",
        default: 100,
        description: "Maximum node count (default: 100).",
      },
      include_hidden: {
        type: "boolean",
        default: false,
        description: "Include dot-prefixed entries (default: false).",
      },
      exclude: {
        type: "array",
        items: { type: "string" },
        description: "Glob patterns to exclude paths.",
      },
    },
    required: ["path"],
  },
} as const;
```

- description 文言は短く、1文で用途が伝わる英語に固定する
- parameters の description も短文化し、曖昧語を入れない

## 5. 走査モデル設計

- 走査単位は「ディレクトリエントリ 1 件」とし、深さ優先で再帰処理する
- 手順は `入力検証 -> ルート確認 -> 子列挙 -> フィルタ -> ソート -> 再帰` の固定順とする
- 子列挙は `Bun.file` ではなくディレクトリ API（`fs.readdir` 相当）を使用し、`withFileTypes` で種別判定する
- `entry_kind="directory"` では再帰対象をディレクトリのみに限定し、ファイル/シンボリックリンクのノードは生成しない
- `entry_kind="all"` ではディレクトリ/ファイル/シンボリックリンクをノード化する
- `max_depth` 到達時は子を読まず、対象ディレクトリに `truncated=true` を付与する
- `max_entries` はルートを含む全ノードでカウントし、到達した時点で以降の走査を停止する
- シンボリックリンクはノード生成のみ行い、リンク先の走査に進まない

## 6. ランキング/優先順位設計

- 初期版では非適用（検索順位付け機能ではないため）
- ただし返却順序の決定性を維持するため、ソート規則は `directory -> file -> symlink`、同種は `name` 昇順で固定する

## 7. フィルタ設計

- 優先順位は `exclude`（glob）一致除外 -> `include_hidden` 判定 -> `entry_kind` 判定 -> 探索継続 の順で適用する
- `exclude` は workspace 相対パスに対する glob として評価する（例: `**/node_modules/**`, `**/*.log`）
- デフォルト除外は `.git`, `node_modules`, `dist`, `build`, `target`, `.vscode`, `.DS_Store` とする
- `include_hidden=false` の場合、`.` で始まる名前を除外する（ファイル/ディレクトリの両方。ルート `path` 自体は除外しない）
- 初期版の hidden 判定は「`.` 始まり」のみを採用し、Windows の hidden 属性は参照しない
- `entry_kind="directory"` では `kind="directory"` のみ返却対象とし、`total_files` と `total_symlinks` は 0 とする

## 8. 実装分割（モジュール責務）

- `src/tools/edit/tree/tool.ts`
  - `TreeInput` 検証、usecase 呼び出し、`TreeOutput` 返却
- `src/tools/edit/tree/usecase.ts`
  - 走査フロー本体、深さ/件数制限、ソート、集計
- `src/tools/edit/tree/filter.ts`
  - デフォルト除外 + 入力 `exclude` + hidden 判定
- `src/tools/edit/tree/types.ts`
  - `TreeInput` / `TreeOutput` / `TreeNode` の型定義を集約
- `src/lib.ts`
  - `ToolCatalog.tree` と `createAgentToolkit().tree` を公開
- `src/registory/definitions.ts`
  - `tree` の JSON Schema を追加
- `test/tools/edit/tree/tool.test.ts`
  - 正常系、深さ制限、件数制限、hidden 除外、ファイル指定エラーを検証
- `test/tools/edit/tree/usecase.test.ts`
  - ソート順・打ち切り条件・シンボリックリンク非展開を検証

既存 `src/tools/edit/apply_patch.ts` とは責務を分離し、共通抽象化は行わない。
`createSecureTool` が第1引数をパスとして正規化する前提に合わせ、`tree` も第1引数を `path` 固定にして衝突を避ける。

## 9. 将来拡張

- `list_files` 連携: `tree` の走査基盤を共通化し、フラット一覧の高速取得へ接続する
- `read_file` 連携: `tree` 結果から選択ノードを順次読み取るバッチ導線を追加する
- `codebase_search` 連携: `tree` の除外設定を検索前処理に再利用し、探索ノイズを削減する
- `git_status_summary` 連携: `tree` ノードに git 変更状態を重畳する拡張ビューを追加する

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |

## 11. 受け入れ基準（Definition of Done）

- 既存ディレクトリを入力すると `root` を含むツリーが返り、`scanned_entries` が 1 以上になる
- `entry_kind` 未指定時は `"directory"` と同等に動作し、返却ノードに `kind="file"`/`kind="symlink"` が含まれない
- `entry_kind="all"` を指定すると、条件に一致する `kind="file"`/`kind="symlink"` を返却できる
- `max_depth=0` で子ノードを展開せず、ルートのみ返る
- `max_depth` 超過で打ち切られたディレクトリに `truncated=true` が付与される
- `max_entries` 到達時に `limit_reached=true` となり、それ以上のノードが返らない
- 同一入力に対しノード順序が常に一致する
- 返却される全ノードの `path` は `workspaceRoot` 起点の相対パスであり、絶対パスが含まれない
- シンボリックリンクは `kind="symlink"` で返り、リンク先ノードが含まれない
- `path` がファイルの場合 `NOT_DIRECTORY`、存在しない場合 `NOT_FOUND` を返す
- `ToolCatalog` と `TOOL_DEFINITIONS` に `tree` が登録される
- `TOOL_DEFINITIONS.tree.description` と各 parameter description が本仕様 `4.4` と完全一致する
- `test/tools/edit/tree/tool.test.ts` と `test/tools/edit/tree/usecase.test.ts` の主要ケースが pass する
- `bun test` が成功する
