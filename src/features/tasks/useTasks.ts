import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Task, TaskDraft } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, TASK_COLORS } from '../../domain/tasks/task';
import { buildRecurrenceRule, isRecurringTask, isVirtualOccurrence } from '../../domain/tasks/recurrence';
import { dexieTaskRepository } from '../../infrastructure/db/dexieTaskRepository';
import { createId } from '../../shared/id';

function normalizeDraft(draft: TaskDraft): TaskDraft {
  const color = TASK_COLORS.find((item) => item.value === draft.color) ?? TASK_COLORS[0];
  const recurrenceType = draft.recurrenceType ?? 'none';
  const recurrenceInterval = Math.max(1, Number(draft.recurrenceInterval || 1));
  const recurrenceDaysOfWeek = [...new Set(draft.recurrenceDaysOfWeek ?? [])]
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  const recurrenceDaysOfMonth = [...new Set(draft.recurrenceDaysOfMonth ?? [])]
    .filter((day) => day >= 1 && day <= 31)
    .sort((a, b) => a - b);

  const normalized: TaskDraft = {
    ...DEFAULT_TASK_DRAFT,
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    textColor: color.textColor,
    reminderMinutesBefore: Math.max(0, Number(draft.reminderMinutesBefore || 0)),
    recurrenceType,
    recurrenceInterval,
    recurrenceDaysOfWeek: recurrenceType === 'weekdays' || recurrenceType === 'weekly' || recurrenceType === 'custom-weeks' ? recurrenceDaysOfWeek : [],
    recurrenceDaysOfMonth: recurrenceType === 'month-days' || recurrenceType === 'monthly' ? recurrenceDaysOfMonth : [],
    recurrenceEndDate: draft.recurrenceEndDate || undefined,
    recurrenceCount: draft.recurrenceCount ? Math.max(1, Number(draft.recurrenceCount)) : undefined,
    exceptionDates: draft.exceptionDates ?? [],
    modifiedOccurrences: draft.modifiedOccurrences ?? {},
    parentTaskId: draft.parentTaskId,
    occurrenceDate: undefined,
    sourceTaskId: undefined,
    isVirtualOccurrence: undefined,
  };

  return {
    ...normalized,
    recurrenceRule: buildRecurrenceRule(normalized),
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
      const taskToUpdate = isVirtualOccurrence(task) && task.sourceTaskId ? tasks.find((item) => item.id === task.sourceTaskId) : task;

      if (!taskToUpdate) {
        throw new Error('No se encontró la serie recurrente para actualizar.');
      }

      const updatedTask: Task = {
        ...taskToUpdate,
        ...normalizeDraft(draft),
        id: taskToUpdate.id,
        createdAt: taskToUpdate.createdAt,
        updatedAt: new Date().toISOString(),
      };

      await dexieTaskRepository.upsert(updatedTask);
      await reload();
      return updatedTask;
    },
    [reload, tasks],
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
      if (isVirtualOccurrence(task) && task.sourceTaskId && task.occurrenceDate) {
        const series = tasks.find((item) => item.id === task.sourceTaskId);

        if (!series) return;

        await dexieTaskRepository.upsert({
          ...series,
          modifiedOccurrences: {
            ...(series.modifiedOccurrences ?? {}),
            [task.occurrenceDate]: {
              ...(series.modifiedOccurrences?.[task.occurrenceDate] ?? {}),
              completed: !task.completed,
            },
          },
          updatedAt: new Date().toISOString(),
        });
        await reload();
        return;
      }

      await dexieTaskRepository.upsert({
        ...task,
        completed: !task.completed,
        updatedAt: new Date().toISOString(),
      });
      await reload();
    },
    [reload, tasks],
  );

  const deleteOccurrence = useCallback(
    async (task: Task) => {
      if (!isVirtualOccurrence(task) || !task.sourceTaskId || !task.occurrenceDate) {
        if (isRecurringTask(task)) {
          await dexieTaskRepository.upsert({
            ...task,
            exceptionDates: [...new Set([...(task.exceptionDates ?? []), task.date])].sort(),
            updatedAt: new Date().toISOString(),
          });
          await reload();
          return;
        }

        await dexieTaskRepository.delete(task.id);
        await reload();
        return;
      }

      const series = tasks.find((item) => item.id === task.sourceTaskId);

      if (!series) return;

      await dexieTaskRepository.upsert({
        ...series,
        exceptionDates: [...new Set([...(series.exceptionDates ?? []), task.occurrenceDate])].sort(),
        updatedAt: new Date().toISOString(),
      });
      await reload();
    },
    [reload, tasks],
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
    deleteOccurrence,
    toggleTaskCompleted,
  };
}
