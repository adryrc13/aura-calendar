import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeTaskAttachments } from '../../domain/tasks/attachment';
import type { Task, TaskDraft } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, TASK_COLORS } from '../../domain/tasks/task';
import { buildRecurrenceRule, isRecurringTask, isVirtualOccurrence } from '../../domain/tasks/recurrence';
import { getActiveTaskRepository } from '../../infrastructure/tasks/taskRepositoryProvider';
import { createId } from '../../shared/id';

const taskRepository = getActiveTaskRepository();

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
    attachments: draft.attachments ?? [],
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
    const allTasks = await taskRepository.getAll();
    setTasks(allTasks);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createTask = useCallback(
    async (draft: TaskDraft) => {
      const now = new Date().toISOString();
      const id = createId();
      const normalizedDraft = normalizeDraft(draft);
      const task: Task = {
        ...normalizedDraft,
        id,
        attachments: normalizeTaskAttachments(normalizedDraft.attachments, id, now),
        createdAt: now,
        updatedAt: now,
      };

      await taskRepository.upsert(task);
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

      const now = new Date().toISOString();
      const normalizedDraft = normalizeDraft(draft);
      const updatedTask: Task = {
        ...taskToUpdate,
        ...normalizedDraft,
        id: taskToUpdate.id,
        attachments: normalizeTaskAttachments(normalizedDraft.attachments, taskToUpdate.id, now),
        createdAt: taskToUpdate.createdAt,
        updatedAt: now,
      };

      await taskRepository.upsert(updatedTask);
      await reload();
      return updatedTask;
    },
    [reload, tasks],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await taskRepository.delete(id);
      await reload();
    },
    [reload],
  );

  const toggleTaskCompleted = useCallback(
    async (task: Task) => {
      if (isVirtualOccurrence(task) && task.sourceTaskId && task.occurrenceDate) {
        const series = tasks.find((item) => item.id === task.sourceTaskId);

        if (!series) return;

        await taskRepository.upsert({
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

      await taskRepository.upsert({
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
          await taskRepository.upsert({
            ...task,
            exceptionDates: [...new Set([...(task.exceptionDates ?? []), task.date])].sort(),
            updatedAt: new Date().toISOString(),
          });
          await reload();
          return;
        }

        await taskRepository.delete(task.id);
        await reload();
        return;
      }

      const series = tasks.find((item) => item.id === task.sourceTaskId);

      if (!series) return;

      await taskRepository.upsert({
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
