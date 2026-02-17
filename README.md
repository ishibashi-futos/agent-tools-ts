# agent-tools-ts

## Developmet

To install dependencies:

```bash
bun install
```

## Usage

Add the package to your Bun project directly from GitHub:

```bash
bun add github:ishibashi-futos/agent-tools-ts#main
```

```typescript
import {
  createAgentToolkit,
  type ToolContext
} from "agent-tools-ts";

const context: ToolContext = {
  // The absolute path to your project root
  workspaceRoot: process.cwd(),
  // Permission levels: "read-only", "workspace-write", or "unrestricted"
  writeScope: "workspace-write",
  policy: {
    // Explicitly allow or deny specific tools
    tools: {
      apply_patch: "allow"
    },
    // Default fallback policy: "allow" or "deny"
    defaultPolicy: "deny"
  }
};

// Create a secured toolkit bound to the context
const toolkit = createAgentToolkit(context);

// Now your agent can execute tools safely
const result = await toolkit.applyPatch(filePath, patchContent);

if (result.status === "success") {
  console.log("Patch applied successfully:", result.data);
} else {
  console.error(`Failed (${result.reason}): ${result.message}`);
}
```
