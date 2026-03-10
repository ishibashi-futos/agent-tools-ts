export type TaskStatus = "todo" | "done" | "canceled";

export type TaskItem = {
  task_id: string;
  status: TaskStatus;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type TaskCreateManyInput = {
  tasks: Array<{
    title: string;
    description?: string;
  }>;
};

export type TaskCreateManyOutput = {
  tasks: TaskItem[];
};

export type TaskListInput = Record<string, never>;

export type TaskListOutput = {
  tasks: TaskItem[];
};

export type TaskUpdateInput = {
  task_id: string;
  title: string;
  description?: string;
};

export type TaskUpdateOutput = {
  task: TaskItem;
};

export type TaskUpdateStatusInput = {
  task_id: string;
  status: TaskStatus;
};

export type TaskUpdateStatusOutput = {
  task: TaskItem;
};

export type TaskValidateCompletionInput = Record<string, never>;

export type TaskValidateCompletionOutput = {
  ok: boolean;
  remaining: string[];
};

export type TodoSessionState = {
  tasks: Map<string, TaskItem>;
  order: string[];
};

export type TodoErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "STATE_NOT_INITIALIZED"
  | "INTERNAL";
