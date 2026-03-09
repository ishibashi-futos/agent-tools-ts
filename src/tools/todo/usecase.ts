import type { ToolContext } from "../../factory";
import { TodoError } from "./error";
import type {
  TaskCreateManyOutput,
  TaskItem,
  TaskListOutput,
  TaskStatus,
  TaskUpdateOutput,
  TaskUpdateStatusOutput,
  TaskValidateCompletionOutput,
  TodoSessionState,
} from "./types";

type Dependencies = {
  now: () => string;
  createTaskId: () => string;
};

const cloneTask = (task: TaskItem): TaskItem => {
  return { ...task };
};

const sortByCreationOrder = (
  state: TodoSessionState,
  mapper: (task: TaskItem) => TaskItem = cloneTask,
): TaskItem[] => {
  return state.order.map((taskId) => {
    const task = state.tasks.get(taskId);
    if (task === undefined) {
      throw new TodoError("INTERNAL", `task not found in state: ${taskId}`);
    }
    return mapper(task);
  });
};

const ensureInitialized = (context: ToolContext): TodoSessionState => {
  if (context.todo === undefined) {
    throw new TodoError(
      "STATE_NOT_INITIALIZED",
      "task state is not initialized. call task_create_many first",
    );
  }
  return context.todo;
};

export const createTodoUsecase = (
  deps: Dependencies = {
    now: () => new Date().toISOString(),
    createTaskId: () => crypto.randomUUID(),
  },
) => {
  const taskCreateMany = (
    context: ToolContext,
    tasks: Array<{ title: string; description?: string }>,
  ): TaskCreateManyOutput => {
    const state: TodoSessionState = {
      tasks: new Map(),
      order: [],
    };

    for (const taskInput of tasks) {
      const now = deps.now();
      const taskId = deps.createTaskId();
      const task: TaskItem = {
        task_id: taskId,
        status: "todo",
        title: taskInput.title,
        created_at: now,
        updated_at: now,
      };

      if (taskInput.description !== undefined) {
        task.description = taskInput.description;
      }

      state.tasks.set(taskId, task);
      state.order.push(taskId);
    }

    context.todo = state;
    return { tasks: sortByCreationOrder(state) };
  };

  const taskList = (context: ToolContext): TaskListOutput => {
    const state = ensureInitialized(context);
    return { tasks: sortByCreationOrder(state) };
  };

  const taskUpdate = (
    context: ToolContext,
    input: { task_id: string; title: string; description?: string },
  ): TaskUpdateOutput => {
    const state = ensureInitialized(context);
    const current = state.tasks.get(input.task_id);
    if (current === undefined) {
      throw new TodoError("NOT_FOUND", `task not found: ${input.task_id}`);
    }

    const next: TaskItem = { ...current };
    let changed = false;

    if (next.title !== input.title) {
      next.title = input.title;
      changed = true;
    }

    if (
      input.description !== undefined &&
      next.description !== input.description
    ) {
      next.description = input.description;
      changed = true;
    }

    if (changed) {
      next.updated_at = deps.now();
      state.tasks.set(input.task_id, next);
      return { task: cloneTask(next) };
    }
    return { task: cloneTask(current) };
  };

  const taskUpdateStatus = (
    context: ToolContext,
    input: { task_id: string; status: TaskStatus },
  ): TaskUpdateStatusOutput => {
    const state = ensureInitialized(context);
    const current = state.tasks.get(input.task_id);
    if (current === undefined) {
      throw new TodoError("NOT_FOUND", `task not found: ${input.task_id}`);
    }

    if (current.status === input.status) {
      return { task: cloneTask(current) };
    }

    const updated: TaskItem = {
      ...current,
      status: input.status,
      updated_at: deps.now(),
    };
    state.tasks.set(input.task_id, updated);
    return { task: cloneTask(updated) };
  };

  const taskValidateCompletion = (
    context: ToolContext,
  ): TaskValidateCompletionOutput => {
    const state = ensureInitialized(context);
    const remaining: string[] = [];

    for (const taskId of state.order) {
      const task = state.tasks.get(taskId);
      if (task === undefined) {
        throw new TodoError("INTERNAL", `task not found in state: ${taskId}`);
      }
      if (task.status === "todo") {
        remaining.push(task.task_id);
      }
    }

    return {
      ok: remaining.length === 0,
      remaining,
    };
  };

  return {
    taskCreateMany,
    taskList,
    taskUpdate,
    taskUpdateStatus,
    taskValidateCompletion,
  };
};

export const todoUsecase = createTodoUsecase();
