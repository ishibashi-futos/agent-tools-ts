# Feature Spec: 外部リポジトリを用いたシナリオテスト

優先度: P1

## 1. 目的

実装済みツール（`tree` / `read_file` / `apply_patch` / `exec_command` / `git_status_summary`）を、実運用に近い外部サンプルリポジトリ上で連続利用し、単体テストでは拾いにくい統合不具合を検出する。
この仕様は `specs/backlog.md` の「各ツールの実用を想定した、外部リポジトリなどを用いたシナリオテスト実装」に対応する。

## 2. 対象範囲

- Bun 系サンプルリポジトリを clone し、依存インストール・ビルド・テスト・軽微編集を行う
- 1 シナリオあたり 2-3 ツールを連続利用する
- セキュリティポリシー適用状態（allow/deny）での動作確認を含む

初期版での非対象:
- 長時間の常駐サーバ起動監視（`spawn_service` 系が未実装のため）
- 外部サービス依存（DB, SaaS 認証）の E2E

## 3. テスト実行方針

### 3.1 MUST

- シナリオテストは通常 `bun test` の対象外であること
- `main` ブランチへの push ごとに `test:e2e` が CI で自動実行されること
- ローカルでは明示コマンド（例: `bun run test:e2e`）で同じシナリオを再実行できること
- 外部リポジトリはテスト開始時に一時ディレクトリへ clone すること
- 再現性のため、clone 後に固定 commit hash へ checkout すること
- 各シナリオは必ず 2-3 ツールを順番に呼ぶこと
- 判定は「ツール戻り値（status/data/message）」のみを一次根拠とすること
- ファイル編集などは、アサーションにより想定した変更が行われているかを実態のファイルを確認すること
- 実行失敗時に、どのツールのどの入力で失敗したかを出力すること

### 3.2 SHOULD

- `git clone --depth 1` を基本とし、必要時のみ追加 fetch する
- 失敗時の調査容易性のため、`exec_command` の `stdout/stderr` をログ保存する
- ネットワーク不安定時の flake 低減として clone リトライを 1 回許可する

## 4. テストデータ管理

- リポジトリ定義は `test/scenario/repos.ts` に集約する
- 各定義は `name`, `url`, `ref`, `prepareCommands` を持つ
- `ref` はブランチ名ではなく commit hash 固定とする
- 一時作業領域は `os.tmpdir()` 配下に作成し、テスト終了時に削除する

例:

```ts
type ExternalRepoFixture = {
  name: string;
  url: string;
  ref: string; // commit hash
  prepareCommands: string[][]; // 例: [["bun","install"],["bun","run","build"]]
};
```

## 5. 対象リポジトリ

1. `honojs/starter`（`templates/bun` 固定）
   `https://github.com/honojs/starter`

注記: `honojs/starter` は将来変更されるため、実装時に commit hash を固定値として更新する。

## 6. 想定シナリオ（5件）

### シナリオ1: 構造把握 + 主要設定参照 + ビルド実行

- 目的: 読み取り系 2 ツールと実行系 1 ツールの連続動作確認
- 対象例: `honojs/starter` の `templates/bun`
- 手順:
  1. `tree(path=".", entry_kind="all", max_depth=2)` で構造取得
  2. `read_file(path="templates/bun/package.json")` で scripts を確認
  3. `exec_command(cwd="templates/bun", command=["bun","run","build"])` を実行
- 期待結果:
  - 1 で `package.json` を含む
  - 2 で `build` script が読める
  - 3 が `status=success` かつ `exit_code=0`

利用ツール: `tree` -> `read_file` -> `exec_command`

### シナリオ2: 設定変更パッチ + テスト実行 + Git状態確認

- 目的: 書き込みツールの実運用チェーン確認
- 対象例: `honojs/starter` の `templates/bun`
- 手順:
  1. `read_file(path="templates/bun/README.md")` で編集対象文言を特定
  2. `apply_patch(filePath="templates/bun/README.md", patch=...)` で 1 行変更
  3. `git_status_summary(cwd=".")` で変更検知
- 期待結果:
  - 2 が `status=success`
  - 3 の `porcelain` に `templates/bun/README.md` の変更が含まれる

利用ツール: `read_file` -> `apply_patch` -> `git_status_summary`

### シナリオ3: ワークスペース限定コマンド実行の正常性

- 目的: `exec_command` 前後で参照情報が整合することを確認
- 対象例: `honojs/starter` の `templates/bun`
- 手順:
  1. `read_file(path="templates/bun/package.json")` で `dev` script を確認
  2. `exec_command(cwd="templates/bun", command=["bun","run","build"])`
  3. `git_status_summary(cwd=".")` で意図しない差分がないことを確認
- 期待結果:
  - 2 が `exit_code=0`
  - 3 の変更が 0 件、または lockfile 変更のみ（許容条件を明示）

利用ツール: `read_file` -> `exec_command` -> `git_status_summary`

### シナリオ4: Policy deny 時の拒否動作

- 目的: セキュリティポリシーが統合経路で機能することを確認
- 対象例: `honojs/starter` の `templates/bun`
- 手順:
  1. `tree` と `read_file` のみ allow、`apply_patch` を deny した `ToolContext` を作成
  2. `read_file(path="templates/bun/README.md")` を実行（成功確認）
  3. `apply_patch(filePath="templates/bun/README.md", patch=...)` を実行（拒否確認）
- 期待結果:
  - 2 は `status=success`
  - 3 は `status=denied` かつ `reason=policy`

利用ツール: `read_file` -> `apply_patch`

### シナリオ5: 深さ制限付き探索 + 対象ファイル読取 + コマンド実行失敗の可観測性

- 目的: エラー時のトレーサビリティ確認
- 対象例: `honojs/starter` の `templates/bun`
- 手順:
  1. `tree(path=".", max_depth=2, entry_kind="directory")`
  2. `read_file(path="templates/bun/package.json")`
  3. `exec_command(cwd="templates/bun", command=["bun","run","__not_found__"])`
- 期待結果:
  - 3 が `status=failure`（runtime）で、エラーメッセージに対象コマンド名を含む
  - 失敗時でも 1, 2 の取得結果がテストログに残る

利用ツール: `tree` -> `read_file` -> `exec_command`

## 7. 実装構成案

- `package.json`
  - `test:e2e` スクリプトを追加（シナリオテスト一式を実行）
- `.github/workflows/e2e-scenarios.yml`
  - `on.push.branches: [main]` で `bun run test:e2e` を実行
  - `strategy.matrix.os` を使用し、`runs-on: ${{ matrix.os }}` で実行環境を切り替える
  - 対象 OS は `ubuntu-latest` / `macos-latest` / `windows-latest` の 3 種とする
- `test/scenario/external_repo_scenarios.test.ts`
  - シナリオ本体（5ケース）
- `test/scenario/helpers/clone_repo.ts`
  - clone / checkout / cleanup
- `test/scenario/helpers/toolkit.ts`
  - `createToolContext` / `createAgentToolkit` の共通セットアップ
- `test/scenario/helpers/assertions.ts`
  - `ToolResult` 用アサーション

## 8. 受け入れ基準（Definition of Done）

- 5 シナリオすべてが `bun run test:e2e` で実行される
- `main` への push ごとに CI で `bun run test:e2e` が実行される
- 通常 `bun test` 実行ではシナリオテストが実行されない
- 各シナリオで 2-3 ツールの連続利用が確認できる
- 正常系・異常系・policy 拒否系を最低 1 件ずつ含む
- 外部リポジトリ参照が commit hash 固定で再現可能である
- 失敗ログから「どのツール入力で失敗したか」を追跡できる

## 9. Open Questions

| 未決事項 | 決定方法（どう決めるか） |
| --- | --- |
| `main` push 時の総実行時間が長い場合の分割方針 | 2 週間運用し、平均実行時間が閾値を超えたらジョブ分割を導入 |
