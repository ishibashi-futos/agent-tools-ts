# Feature Spec: `todo`

優先度: `<PRIORITY>`（未確定）

## 1. 目的

エージェント実行中に、セッション単位でタスクを作成・参照・更新・完了判定できる最小プリミティブを提供する。
本機能は、複数ステップの実行を「未着手/完了/中止」で可視化し、やり残しを機械的に検知するための基盤である。
初期版は「シンプルで唯一の正解」を優先し、単一セッション内メモリ状態への決定的な読み書きに限定する。

## 2. ユースケース

- エージェントが実行開始時に `task_create_many` で作業計画を初期化し、進行中に参照する
- エージェントが各ステップ完了時に `task_update_status` を呼び、`done` へ遷移させる
- エージェントが方針変更時に `task_update` でタイトル/説明を更新し、計画を最新化する
- エージェントが終了前に `task_validate_completion` を実行し、未完了タスクを検知して報告する

## 3. 要求仕様（機能要件）

### 3.1 MUST

- `task_create_many` / `task_list` / `task_update` / `task_update_status` / `task_validate_completion` をツールとして提供する
- タスク状態は実行コンテキスト単位（セッションスコープ）で保持し、別コンテキストへ共有しない
- `task_id` はセッション内で一意な文字列（UUID v4 形式）として採番する
- `task_create_many` を再実行した場合、既存タスクは全件破棄し、入力 `tasks` で完全に洗い替える
- `task_list` は作成順で安定ソートした配列を返す
- `task_update_status` は `todo | done | canceled` 以外の状態を拒否する
- `task_validate_completion` は `status === "todo"` の `task_id` 配列を `remaining` に返し、0 件時のみ `ok: true` を返す
- すべての入力文字列は UTF-8 前提で扱い、Windows パス文字列を説明に含む場合は JSON 上で `\\` エスケープを必要とすることを metadata に明記する

### 3.2 SHOULD

- `title` は trim 後 1..200 文字、`description` は 0..2000 文字の上限を設ける
- `task_create_many` は空配列を拒否し、1 回の投入上限を 100 件に制限する
- `task_update` は実際に変更がない場合も成功として扱い、冪等にする
- `task_list` 返却に `created_at` / `updated_at` を含め、更新順の追跡を容易にする

### 3.3 WON'T（初期版では非対応）

- 永続化（ファイル保存、DB 保存、プロセス再起動後の復元）
- タスクの階層構造（親子、サブタスク）
- 優先度スコアや期限による自動並び替え
- 複数セッション間でのタスク統合表示

## 4. 入出力仕様（Tool I/O）

### 4.1 Input

```ts
type TaskStatus = "todo" | "done" | "canceled";

type TaskCreateManyInput = {
  tasks: Array<{
    title: string; // 必須、trim後 1..200 文字
    description?: string; // 任意、最大 2000 文字
  }>;
};

type TaskListInput = Record<string, never>;

type TaskUpdateInput = {
  task_id: string; // 必須、UUID v4
  title: string; // 必須、trim後 1..200 文字
  description?: string; // 任意、最大 2000 文字
};

type TaskUpdateStatusInput = {
  task_id: string; // 必須、UUID v4
  status: TaskStatus; // 必須
};

type TaskValidateCompletionInput = Record<string, never>;
```

### 4.2 Output

```ts
type TaskItem = {
  task_id: string;
  status: TaskStatus;
  title: string;
  description?: string;
  created_at: string; // ISO 8601 UTC
  updated_at: string; // ISO 8601 UTC
};

type TaskCreateManyOutput = {
  tasks: TaskItem[];
};

type TaskListOutput = {
  tasks: TaskItem[];
};

type TaskUpdateOutput = {
  task: TaskItem;
};

type TaskUpdateStatusOutput = {
  task: TaskItem;
};

type TaskValidateCompletionOutput = {
  ok: boolean;
  remaining: string[]; // 未完了タスクの task_id 一覧
};
```

### 4.3 Error

- `INVALID_ARGUMENT`: 必須項目欠落、型不正、長さ制約違反
- `NOT_FOUND`: 指定 `task_id` がセッション内に存在しない
- `STATE_NOT_INITIALIZED`: `task_create_many` 実行前に参照/更新系 API が呼ばれた
- `INTERNAL`: 想定外エラー

### 4.4 Tool Definition Metadata

`src/registory/definitions.ts` に次の 5 定義を追加する。

```ts
const TASK_CREATE_MANY_DEFINITION = {
  name: "task_create_many",
  description: "Creates initial task list for the current execution session.",
  parameters: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        description: "Initial tasks (max: 100).",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Task title.",
            },
            description: {
              type: "string",
              description:
                "Optional detail. Escape Windows backslashes in JSON, e.g. C:\\\\repo\\\\src.",
            },
          },
          required: ["title"],
        },
      },
    },
    required: ["tasks"],
  },
} as const;

const TASK_LIST_DEFINITION = {
  name: "task_list",
  description: "Returns all tasks in creation order for this session.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
} as const;

const TASK_UPDATE_DEFINITION = {
  name: "task_update",
  description: "Updates title or description of an existing session task.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "Target task id." },
      title: { type: "string", description: "New task title." },
      description: {
        type: "string",
        description:
          "Optional detail. Escape Windows backslashes in JSON, e.g. C:\\\\repo\\\\src.",
      },
    },
    required: ["task_id", "title"],
  },
} as const;

const TASK_UPDATE_STATUS_DEFINITION = {
  name: "task_update_status",
  description: "Updates status of an existing session task.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "Target task id." },
      status: {
        type: "string",
        enum: ["todo", "done", "canceled"],
        description: "New task status.",
      },
    },
    required: ["task_id", "status"],
  },
} as const;

const TASK_VALIDATE_COMPLETION_DEFINITION = {
  name: "task_validate_completion",
  description: "Validates whether unfinished todo tasks remain in this session.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
} as const;
```

## 5. 状態モデル設計

- セッション状態は `TodoSessionState`（`tasks` と `order`）で表現し、`ToolContext` 拡張フィールドから参照可能にする
- `tasks` は `Map<string, TaskItem>` と `order: string[]` を併用し、検索 O(1) と作成順維持を両立する
- 更新方式は単一セッション内の逐次実行を前提とし、書き込みは 1 操作 1 コミットで行う
- `task_create_many` の再実行時は `tasks` と `order` を初期化し、新規入力のみを保持する

## 6. ランキング/優先順位設計

- 初期版では非適用（順位付け機能ではないため）

## 7. フィルタ設計

- `task_list` は `status` フィルタを持たず、全件返却を唯一仕様とする
- `task_validate_completion` は `todo` のみ未完了と判定し、`done` と `canceled` は完了扱いにする

## 8. 実装分割（モジュール責務）

- `src/tools/todo/session_state.ts`（新規）
  - セッション内状態（`TodoSessionState`）の生成・取得・初期化を担当
- `src/tools/todo/task_create_many/tool.ts`（新規）
  - I/O 変換、validator 呼び出し、usecase 実行を担当
- `src/tools/todo/task_create_many/usecase.ts`（新規）
  - タスク一括作成、UUID 採番、再実行時の完全洗い替えを担当
- `src/tools/todo/task_list/tool.ts`（新規）
  - 全件取得の I/O 変換を担当
- `src/tools/todo/task_update/tool.ts` / `src/tools/todo/task_update_status/tool.ts`（新規）
  - 更新系の入力検証・エラー正規化を担当
- `src/tools/todo/common/validator.ts`（新規）
  - タイトル/説明/状態/UUID の共通検証を担当
- `src/tools/todo/common/error.ts`（新規）
  - `STATE_NOT_INITIALIZED` を含む todo 固有エラーを担当
- `src/lib.ts`（更新）
  - `ToolCatalog` と `createAgentToolkit().tools` に 5 ツールを追加
- `src/toolkit/invoke/index.ts`（更新）
  - `ToolArgsByName` / `ToolResultByName` / resolver に 5 ツールを追加
- `src/registory/definitions.ts`（更新）
  - 5 ツールの definition 文言を仕様と一致させて追加
- `test/tools/todo/**/*.test.ts`（新規）
  - 正常系、入力不正、未初期化、残タスク検知、再実行時の完全洗い替えを検証
- `test/lib.test.ts` / `test/registory/invoke.test.ts`（更新）
  - `ToolCatalog` / `invoke` への登録整合性を検証

既存 `write_file` / `apply_patch` などの責務とは分離し、todo 状態管理は `src/tools/todo/` に限定する。既存 `createSecureTool` のガードレール層は再利用し、認可・sandbox 判定ロジックを重複実装しない。

## 9. 将来拡張

- `exec_command` 連携: `task_validate_completion` が `ok: false` の場合に危険コマンド実行を抑止する事前チェックを追加する
- `invoke` 連携: tool 実行成功時に対応タスクを自動 `done` へ遷移させるオーケストレーション層を追加する
- `git_status_summary` 連携: 変更ファイル有無に応じて「コミット前確認タスク」を自動生成する
- `scenario_test_external_repos` 連携: 実シナリオテストで task 状態遷移の再現性を計測する

## 10. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| `<PRIORITY>` を P0-P4 のどれにするか | `specs/backlog.md` の `todo` セクションへ優先度付き項目を追加し、週次プランニングで `exec`/`edit` 依存との順序を合意して決定する |

## 11. 受け入れ基準（Definition of Done）

- `ToolCatalog` と `createAgentToolkit().tools` から 5 ツール（`task_create_many` など）が呼び出せる
- `task_create_many` 実行後、`task_list` は作成順で同件数のタスクを返す
- 存在しない `task_id` を `task_update` / `task_update_status` に渡すと `NOT_FOUND` を返す
- `task_update_status` に `todo|done|canceled` 以外を渡すと `INVALID_ARGUMENT` を返す
- `task_validate_completion` は未完了が 1 件以上あると `ok: false` かつ `remaining.length >= 1` を返す
- `task_create_many` を再実行すると、前回までのタスクは返却結果に残らず、新規入力分のみが `task_list` に存在する
- `TOOL_DEFINITIONS` の 5 定義（name/description/parameters）が本仕様 4.4 と完全一致する
- `test/tools/todo/**/*.test.ts` が pass する
- `scripts/sanity.sh` が成功する

未確定事項サマリ:
- 優先度 `<PRIORITY>` は backlog 反映後に確定する。
