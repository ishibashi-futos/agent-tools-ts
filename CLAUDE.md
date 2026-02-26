# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a TypeScript library for creating secure toolkits that can be used by AI agents. It provides a framework for executing tools safely within defined security boundaries, including file system access control and policy enforcement.

The core architecture revolves around:
- Secure execution context (`ToolContext`)
- Tool definitions with metadata
- Security policies to restrict tool usage
- Sandboxed file system operations

## Key Components

### Core Architecture

1. **Tool Context**: Defines the execution environment including workspace root, file access scope, and security policy
2. **Security Policy System**: Controls which tools can be executed based on configured permissions
3. **Sandboxed File System**: Provides safe filesystem access with validation against workspace boundaries
4. **Secure Tool Wrappers**: Apply security checks before executing tool functions

### Available Tools

The toolkit provides several core tools:
- `apply_patch`: Applies git patches to files (uses git apply)
- `exec_command`: Executes shell commands in the workspace
- `tree`: Lists directory structures
- `read_file`: Reads text files with line limits
- `git_status_summary`: Gets current git status

### Architecture Layers

1. **Tool Definitions**: Located in `/src/tools/` - Each tool has:
   - Metadata (name, description)
   - Implementation (`tool.ts`)
   - Use cases (`usecase.ts`)
   - Validation logic (`validator.ts`)
   - Types (`types.ts`)

2. **Security Layer**:
   - Policy enforcement (`security/policy.ts`)
   - Sandbox path resolution and validation (`sandbox/path.ts`, `sandbox/fs.ts`)
   - Security wrapper application (`factory.ts`)

3. **Toolkit Interface**:
   - Main library interface in `/src/lib.ts`
   - Tool invocation system (`toolkit/invoke/index.ts`)
   - Tool catalog management

## Development Setup

### Installation
```bash
bun install
```

### Running Tests
```bash
# Run all tests
bun test

# Run a specific test file
bun test path/to/test-file.test.ts

# Typecheck
bun run typecheck

# Format code
bun run format

# Full sanity check (format + typecheck + test)
bun run sanity
```

### Testing Strategy

Tests are organized by tool in `/test/tools/` with:
- Unit tests for each tool's implementation
- Integration tests covering security checks and sandbox operations
- Mock-based testing to isolate functionality

## Key Files & Directories

- `src/lib.ts`: Main entry point and toolkit creation function
- `src/factory.ts`: Tool context and secure wrapper factory
- `src/tools/`: Individual tool implementations
- `src/security/policy.ts`: Policy enforcement logic
- `src/sandbox/`: Sandboxed filesystem operations
- `test/`: Test suite for all components

## Usage Pattern

```typescript
import { createToolContext, createAgentToolkit } from 'agent-tools-ts';

const context = createToolContext({
  workspaceRoot: process.cwd(),
  writeScope: "workspace-write",
  policy: {
    tools: {
      apply_patch: "allow"
    },
    defaultPolicy: "deny"
  }
});

const toolkit = createAgentToolkit(context);

// Using direct tool calls (old API)
const result = await toolkit.tools.applyPatch(filePath, patchContent);

// Using invoke API (new preferred approach)
const result = await toolkit.invoke("apply_patch", { filePath, content });
```

## Security Model

The security model enforces two main layers:
1. **Policy Layer**: Tool permission control using allow/deny policies
2. **Sandbox Layer**: File system access validation that ensures operations are within the workspace boundaries

All tool execution goes through `createSecureTool` wrapper which applies both checks.

This approach prevents:
- Unauthorized file system access outside the defined scope
- Execution of tools not explicitly allowed by policy