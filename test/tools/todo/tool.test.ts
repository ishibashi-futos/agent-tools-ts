import { describe, expect, it } from "bun:test";
import { createSecureTool, type ToolContext } from "../../../src/factory";
import {
  taskCreateMany,
  taskList,
  taskUpdate,
  taskUpdateStatus,
  taskValidateCompletion,
} from "../../../src/tools/todo/tool";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createContext = (): ToolContext => {
  return {
    workspaceRoot: process.cwd(),
    writeScope: "workspace-write",
    policy: {
      tools: {
        task_create_many: "allow",
        task_list: "allow",
        task_update: "allow",
        task_update_status: "allow",
        task_validate_completion: "allow",
      },
      defaultPolicy: "deny",
    },
    env: {
      platform: process.platform,
      osRelease: "test",
    },
  };
};

describe("todo tools", () => {
  it("task_create_many はタスクを再初期化して作成順で返すこと", async () => {
    const context = createContext();
    const secureTaskCreateMany = createSecureTool(
      { name: "task_create_many", isWriteOp: false },
      taskCreateMany,
    );

    const first = await secureTaskCreateMany(context, {
      tasks: [{ title: "  step 1  " }, { title: "step 2", description: "d2" }],
    });
    expect(first.status).toBe("success");
    if (first.status !== "success") {
      throw new Error("Expected success but got non-success");
    }
    expect(first.data.tasks.length).toBe(2);
    expect(first.data.tasks[0]?.title).toBe("step 1");
    expect(first.data.tasks[0]?.status).toBe("todo");
    expect(
      first.data.tasks.every((task) => UUID_V4_REGEX.test(task.task_id)),
    ).toBe(true);

    const second = await secureTaskCreateMany(context, {
      tasks: [{ title: "replaced" }],
    });
    expect(second.status).toBe("success");
    if (second.status !== "success") {
      throw new Error("Expected success but got non-success");
    }
    expect(second.data.tasks.length).toBe(1);
    expect(second.data.tasks[0]?.title).toBe("replaced");
  });

  it("task_list は未初期化状態で STATE_NOT_INITIALIZED を返すこと", async () => {
    const context = createContext();
    const secureTaskList = createSecureTool(
      { name: "task_list", isWriteOp: false },
      taskList,
    );

    const result = await secureTaskList(context, {});
    expect(result.status).toBe("failure");
    if (result.status !== "failure") {
      throw new Error("Expected failure but got non-failure");
    }
    expect(result.message).toContain("STATE_NOT_INITIALIZED");
  });

  it("task_update と task_update_status と task_validate_completion が状態更新できること", async () => {
    const context = createContext();
    const secureTaskCreateMany = createSecureTool(
      { name: "task_create_many", isWriteOp: false },
      taskCreateMany,
    );
    const secureTaskList = createSecureTool(
      { name: "task_list", isWriteOp: false },
      taskList,
    );
    const secureTaskUpdate = createSecureTool(
      { name: "task_update", isWriteOp: false },
      taskUpdate,
    );
    const secureTaskUpdateStatus = createSecureTool(
      { name: "task_update_status", isWriteOp: false },
      taskUpdateStatus,
    );
    const secureTaskValidateCompletion = createSecureTool(
      { name: "task_validate_completion", isWriteOp: false },
      taskValidateCompletion,
    );

    const created = await secureTaskCreateMany(context, {
      tasks: [{ title: "a" }, { title: "b" }],
    });
    if (created.status !== "success") {
      throw new Error("Expected success but got non-success");
    }
    const firstTaskId = created.data.tasks[0]?.task_id;
    if (firstTaskId === undefined) {
      throw new Error("task id is missing");
    }

    const updated = await secureTaskUpdate(context, {
      task_id: firstTaskId,
      title: "a-updated",
      description: "desc",
    });
    expect(updated.status).toBe("success");
    if (updated.status !== "success") {
      throw new Error("Expected success but got non-success");
    }
    expect(updated.data.task.title).toBe("a-updated");
    expect(updated.data.task.description).toBe("desc");

    const changedStatus = await secureTaskUpdateStatus(context, {
      task_id: firstTaskId,
      status: "done",
    });
    expect(changedStatus.status).toBe("success");
    if (changedStatus.status !== "success") {
      throw new Error("Expected success but got non-success");
    }
    expect(changedStatus.data.task.status).toBe("done");

    const validated = await secureTaskValidateCompletion(context, {});
    expect(validated.status).toBe("success");
    if (validated.status !== "success") {
      throw new Error("Expected success but got non-success");
    }
    expect(validated.data.ok).toBe(false);
    expect(validated.data.remaining.length).toBe(1);

    const listed = await secureTaskList(context, {});
    expect(listed.status).toBe("success");
    if (listed.status !== "success") {
      throw new Error("Expected success but got non-success");
    }
    expect(listed.data.tasks.map((task) => task.title)).toEqual([
      "a-updated",
      "b",
    ]);
  });
});
