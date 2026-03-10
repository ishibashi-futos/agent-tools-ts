import { TodoError } from "./error";
import type {
  TaskCreateManyInput,
  TaskStatus,
  TaskUpdateInput,
  TaskUpdateStatusInput,
} from "./types";

const MIN_TASK_COUNT = 1;
const MAX_TASK_COUNT = 100;
const MIN_TITLE_LENGTH = 1;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeTitle = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new TodoError("INVALID_ARGUMENT", "title must be a string");
  }

  const trimmed = value.trim();
  if (trimmed.length < MIN_TITLE_LENGTH || trimmed.length > MAX_TITLE_LENGTH) {
    throw new TodoError(
      "INVALID_ARGUMENT",
      `title must be ${MIN_TITLE_LENGTH}..${MAX_TITLE_LENGTH} chars after trim`,
    );
  }
  return trimmed;
};

const normalizeDescription = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TodoError("INVALID_ARGUMENT", "description must be a string");
  }
  if (value.length > MAX_DESCRIPTION_LENGTH) {
    throw new TodoError(
      "INVALID_ARGUMENT",
      `description must be 0..${MAX_DESCRIPTION_LENGTH} chars`,
    );
  }
  return value;
};

export const validateTaskId = (taskId: unknown): string => {
  if (typeof taskId !== "string" || !UUID_V4_REGEX.test(taskId)) {
    throw new TodoError("INVALID_ARGUMENT", "task_id must be UUID v4");
  }
  return taskId;
};

export const validateTaskStatus = (status: unknown): TaskStatus => {
  if (status !== "todo" && status !== "done" && status !== "canceled") {
    throw new TodoError(
      "INVALID_ARGUMENT",
      'status must be one of "todo", "done", "canceled"',
    );
  }
  return status;
};

export const validateTaskCreateManyInput = (
  input: TaskCreateManyInput,
): {
  tasks: Array<{
    title: string;
    description?: string;
  }>;
} => {
  if (!Array.isArray(input.tasks)) {
    throw new TodoError("INVALID_ARGUMENT", "tasks must be an array");
  }
  if (
    input.tasks.length < MIN_TASK_COUNT ||
    input.tasks.length > MAX_TASK_COUNT
  ) {
    throw new TodoError(
      "INVALID_ARGUMENT",
      `tasks must contain ${MIN_TASK_COUNT}..${MAX_TASK_COUNT} items`,
    );
  }

  return {
    tasks: input.tasks.map((task, index) => {
      if (typeof task !== "object" || task === null || Array.isArray(task)) {
        throw new TodoError(
          "INVALID_ARGUMENT",
          `tasks[${index}] must be an object`,
        );
      }
      return {
        title: normalizeTitle(task.title),
        description: normalizeDescription(task.description),
      };
    }),
  };
};

export const validateTaskUpdateInput = (
  input: TaskUpdateInput,
): {
  task_id: string;
  title: string;
  description?: string;
} => {
  return {
    task_id: validateTaskId(input.task_id),
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
  };
};

export const validateTaskUpdateStatusInput = (
  input: TaskUpdateStatusInput,
): {
  task_id: string;
  status: TaskStatus;
} => {
  return {
    task_id: validateTaskId(input.task_id),
    status: validateTaskStatus(input.status),
  };
};
