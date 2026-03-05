import { resolve } from "node:path";
import { createAgentToolkit, type ToolContext } from "../../src/lib";

const context: ToolContext = {
  workspaceRoot: resolve("./test-workspace"),
  writeScope: "workspace-write",
  policy: {
    tools: {
      read_file: "allow",
      exec_command: "allow",
    },
    defaultPolicy: "deny",
  },
  env: { platform: "linux", osRelease: "5.4.0" },
};

const toolkit = createAgentToolkit(context);

void toolkit.invoke("read_file", { path: "src/lib.ts" });
void toolkit.invoke("exec_command", { cwd: ".", command: ["pwd"] });

// @ts-expect-error read_file の引数は path が必要
void toolkit.invoke("read_file", { cwd: "." });

// @ts-expect-error exec_command の引数は command が必要
void toolkit.invoke("exec_command", { cwd: "." });
