# agent-tools-ts

## Development

依存関係をインストール:

```bash
bun install
```

## Usage

GitHub から Bun プロジェクトに追加:

```bash
bun add github:ishibashi-futos/agent-tools-ts#main
```

```typescript
import {
  createToolContext,
  createAgentToolkit,
} from "agent-tools-ts";

const context = createToolContext({
  // プロジェクトルートの絶対パス
  workspaceRoot: process.cwd(),
  // 権限レベル: "read-only" | "workspace-write" | "unrestricted"
  writeScope: "workspace-write",
  policy: {
    // ツールごとの許可/拒否
    tools: {
      apply_patch: "allow",
      read_file: "allow",
    },
    // 未指定ツールに適用する既定ポリシー
    defaultPolicy: "deny",
  },
});

// Context に紐づく安全な toolkit を生成
const toolkit = createAgentToolkit(context);

// 直接呼び出し API（tools 配下）
const patch = "@@ -1 +1 @@\n-old\n+new\n";
const result = await toolkit.tools.apply_patch("README.md", patch);

if (result.status === "success") {
  console.log("Patch applied:", result.data);
} else {
  console.error(`Failed (${result.reason}): ${result.message}`);
  console.error(`Error code: ${result.error.code}`);
}

// invoke API（name + args で実行）
const invoked = await toolkit.invoke("read_file", {
  path: "README.md",
  max_lines: 20,
});
console.log(invoked.role, invoked.name, invoked.content);
```

## Development in Docker

LM Studio と連携して実行:

```bash
WIN_IP=$(ip route | awk '/default/ {print $3; exit}')
docker run -it --rm --add-host=host.docker.internal:$WIN_IP -v $(pwd):/workspace:rw claude:node24 bash
claude --dangerously-skip-permissions --model {model-name}
```
