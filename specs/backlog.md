# Backlog

## Priority

P0: 最も高い ~ P4: 最も低い

## `search` 検索

- [ ] regexp_search: 正規表現を使ってコードベース全体から特定のパターンを探す
- [ ] codebase_search: セマンティック検索を使用して、関連するファイル・チャンク・シンボルなどを検索する
- [ ] find_function_definition: 関数定義を取得する
- [ ] search_with_context: ヒットした行の前後のコンテキストを取得する
- [ ] list_files_by_type: 特定の言語や拡張子に絞って検索する
- [ ] symbol_usage: シンボルの参照・定義・その他使用箇所を検索する
- [ ] [P1] ast_grep_search: ast-grep を使って構文木ベースでコードパターンを検索する（language, pattern, include, exclude, top_k）

## `git` バージョン管理

- [ ] git_diff: 現在のリポジトリ（もしくは指定したファイル）の diff を取得する
- [ ] git_log: 現在のリポジトリの、過去ログを取得する(何件まで遡るか指定)
- [ ] [P0] git_status_summary: ワークツリーの状態を取得する

## `edit` ファイル操作

- [x] apply_patch: ファイルを差分で書き換え
- [ ] create_file: ファイル作成
- [ ] create_directory: ワークスペースに新しいディレクトリを作成
- [ ] [P0] read_file: ファイル読み取り
- [ ] [P0] list_files: ファイルリスト取得
- [ ] [P0] tree: ファイル・ディレクトリツリーの取得

## `exec` コマンド実行

- [ ] [P0] exec_command: 指定したコマンドを実行し、実行結果を返します
- [ ] spawn_service: `bun run dev` / `cargo run` などで起動した、サービスをバックグラウンドで起動する処理をスタートします
- [ ] list_services: 起動中のサービスリストを取得します
- [ ] get_service_logs: spawnしたサービスのログを取得します
- [ ] stop_service: 起動したサービスを停止します

## `todo` アクションアイテム管理

セッション内での ToDo アイテムの管理

- [ ] todo_add: todo アイテムの追加 `title: description`
- [ ] todo_list: todo アイテムのリスト確認
- [ ] todo_done: 指定した todo アイテムの完了
- [ ] todo_remove: 指定した todo アイテムの除去
- [ ] todo_clear: todo アイテムのクリア
