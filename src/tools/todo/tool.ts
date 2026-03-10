import type { ToolContext } from "../../factory";
import { toInternalError } from "./error";
import type {
  TaskCreateManyInput,
  TaskCreateManyOutput,
  TaskListInput,
  TaskListOutput,
  TaskUpdateInput,
  TaskUpdateOutput,
  TaskUpdateStatusInput,
  TaskUpdateStatusOutput,
  TaskValidateCompletionInput,
  TaskValidateCompletionOutput,
} from "./types";
import { todoUsecase } from "./usecase";
import {
  validateTaskCreateManyInput,
  validateTaskUpdateInput,
  validateTaskUpdateStatusInput,
} from "./validator";

type Dependencies = {
  usecase: typeof todoUsecase;
};

export type TaskCreateManyHandler = (
  context: ToolContext,
  input: TaskCreateManyInput,
) => Promise<TaskCreateManyOutput>;

export type TaskListHandler = (
  context: ToolContext,
  _input: TaskListInput,
) => Promise<TaskListOutput>;

export type TaskUpdateHandler = (
  context: ToolContext,
  input: TaskUpdateInput,
) => Promise<TaskUpdateOutput>;

export type TaskUpdateStatusHandler = (
  context: ToolContext,
  input: TaskUpdateStatusInput,
) => Promise<TaskUpdateStatusOutput>;

export type TaskValidateCompletionHandler = (
  context: ToolContext,
  _input: TaskValidateCompletionInput,
) => Promise<TaskValidateCompletionOutput>;

export const createTaskCreateMany = (
  deps: Dependencies = {
    usecase: todoUsecase,
  },
): TaskCreateManyHandler => {
  return async (
    context: ToolContext,
    input: TaskCreateManyInput,
  ): Promise<TaskCreateManyOutput> => {
    try {
      const validated = validateTaskCreateManyInput(input);
      return deps.usecase.taskCreateMany(context, validated.tasks);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const createTaskList = (
  deps: Dependencies = {
    usecase: todoUsecase,
  },
): TaskListHandler => {
  return async (
    context: ToolContext,
    _input: TaskListInput,
  ): Promise<TaskListOutput> => {
    try {
      return deps.usecase.taskList(context);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const createTaskUpdate = (
  deps: Dependencies = {
    usecase: todoUsecase,
  },
): TaskUpdateHandler => {
  return async (
    context: ToolContext,
    input: TaskUpdateInput,
  ): Promise<TaskUpdateOutput> => {
    try {
      const validated = validateTaskUpdateInput(input);
      return deps.usecase.taskUpdate(context, validated);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const createTaskUpdateStatus = (
  deps: Dependencies = {
    usecase: todoUsecase,
  },
): TaskUpdateStatusHandler => {
  return async (
    context: ToolContext,
    input: TaskUpdateStatusInput,
  ): Promise<TaskUpdateStatusOutput> => {
    try {
      const validated = validateTaskUpdateStatusInput(input);
      return deps.usecase.taskUpdateStatus(context, validated);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const createTaskValidateCompletion = (
  deps: Dependencies = {
    usecase: todoUsecase,
  },
): TaskValidateCompletionHandler => {
  return async (
    context: ToolContext,
    _input: TaskValidateCompletionInput,
  ): Promise<TaskValidateCompletionOutput> => {
    try {
      return deps.usecase.taskValidateCompletion(context);
    } catch (error) {
      throw toInternalError(error);
    }
  };
};

export const taskCreateMany = createTaskCreateMany();
export const taskList = createTaskList();
export const taskUpdate = createTaskUpdate();
export const taskUpdateStatus = createTaskUpdateStatus();
export const taskValidateCompletion = createTaskValidateCompletion();
