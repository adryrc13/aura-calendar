import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Task, TaskDraft } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, TASK_COLORS } from '../../domain/tasks/task';
import { dexieTaskRepository } from '../../infrastructure/db/dexieTaskRepository';
import { createId } from '../../shared/id';

function normalizeDraft(draft: TaskDraft): TaskDraft {
  const color = TASK_COLORS.find((item) => item.value === draft.color) ?? TASK_COLORS[0];

  return {
    ...DEFAULT_TASK_DRAFT,
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    textColor: color.textColor,
    reminderMinutesBefore: Math.max(0, Number(draft.reminderMinutesBefore || 0)),
  };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const allTasks = await dexieTaskRepository.getAll();
    setTasks(allTasks);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createTask = useCallback(
    async (draft: TaskDraft) => {
      const now = new Date().toISOString();
      const task: Task = {
        ...normalizeDraft(draft),
        id: createId(),
        createdAt: now,
        updatedAt: now,
      };

      await dexieTaskRepository.upsert(task);
      await reload();
      return task;
    },
    [reload],
  );

  const updateTask = useCallback(
    async (task: Task, draft: TaskDraft) => {
      const updatedTask: Task = {
        ...task,
        ...normalizeDraft(draft),
        id: task.id,
        createdAt: task.createdAt,
        updatedAt: new Date().toISOString(),
      };

      await dexieTaskRepository.upsert(updatedTask);
      await reload();
      return updatedTask;
    },
    [reload],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await dexieTaskRepository.delete(id);
      await reload();
    },
    [reload],
  );

  const toggleTaskCompleted = useCallback(
    async (task: Task) => {
      await dexieTaskRepository.upsert({
        ...task,
        completed: !task.completed,
        updatedAt: new Date().toISOString(),
      });
      await reload();
    },
    [reload],
  );

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => !task.completed).length;
    return { total: tasks.length, pending, completed: tasks.length - pending };
  }, [tasks]);

  return {
    tasks,
    isLoading,
    stats,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskCompleted,
  };
}
