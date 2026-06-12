import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeTaskAttachments } from '../../domain/tasks/attachment';
import type { Task, TaskDraft } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, TASK_COLORS } from '../../domain/tasks/task';
import { buildRecurrenceRule, isRecurringTask, isVirtualOccurrence } from '../../domain/tasks/recurrence';
import {
  getTaskRepository,
  getTaskRepositoryMode,
  setTaskRepositoryMode,
  subscribeTaskRepositoryModeChange,
  type TaskRepositoryMode,
} from '../../infrastructure/tasks/taskRepositoryProvider';
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
  const [taskRepositoryMode, setTaskRepositoryModeState] = useState<TaskRepositoryMode>(() => getTaskRepositoryMode());
  const [taskError, setTaskError] = useState('');

  useEffect(() => subscribeTaskRepositoryModeChange(setTaskRepositoryModeState), []);

  const repository = useMemo(() => getTaskRepository(taskRepositoryMode), [taskRepositoryMode]);

  const reload = useCallback(async () => {
    setIsLoading(true);

    try {
      const allTasks = await repository.getAll();
      setTasks(allTasks);
      setTaskError('');
    } catch (error) {
      const message = errorMessage(error);

      if (taskRepositoryMode === 'remote') {
        setTaskRepositoryMode('local');
        const localTasks = await getTaskRepository('local').getAll();
        setTasks(localTasks);
        setTaskError(`${message} Volvimos a modo local para no perder datos.`);
      } else {
        setTaskError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [repository, taskRepositoryMode]);

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

      try {
        await repository.upsert(task);
        await reload();
        return task;
      } catch (error) {
        throw setOperationError('No pudimos crear la tarea.', error, setTaskError);
      }
    },
    [reload, repository],
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
        calendarId: taskToUpdate.calendarId,
        ownerId: taskToUpdate.ownerId,
        attachments: normalizeTaskAttachments(normalizedDraft.attachments, taskToUpdate.id, now),
        createdAt: taskToUpdate.createdAt,
        updatedAt: now,
      };

      try {
        await repository.upsert(updatedTask);
        await reload();
        return updatedTask;
      } catch (error) {
        throw setOperationError('No pudimos actualizar la tarea.', error, setTaskError);
      }
    },
    [reload, repository, tasks],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      try {
        await repository.delete(id);
        await reload();
      } catch (error) {
        throw setOperationError('No pudimos eliminar la tarea.', error, setTaskError);
      }
    },
    [reload, repository],
  );

  const toggleTaskCompleted = useCallback(
    async (task: Task) => {
      try {
        if (isVirtualOccurrence(task) && task.sourceTaskId && task.occurrenceDate) {
          const series = tasks.find((item) => item.id === task.sourceTaskId);

          if (!series) return;

          await repository.upsert({
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

        await repository.upsert({
          ...task,
          completed: !task.completed,
          updatedAt: new Date().toISOString(),
        });
        await reload();
      } catch (error) {
        throw setOperationError('No pudimos cambiar el estado de la tarea.', error, setTaskError);
      }
    },
    [reload, repository, tasks],
  );

  const deleteOccurrence = useCallback(
    async (task: Task) => {
      try {
        if (!isVirtualOccurrence(task) || !task.sourceTaskId || !task.occurrenceDate) {
          if (isRecurringTask(task)) {
            await repository.upsert({
              ...task,
              exceptionDates: [...new Set([...(task.exceptionDates ?? []), task.date])].sort(),
              updatedAt: new Date().toISOString(),
            });
            await reload();
            return;
          }

          await repository.delete(task.id);
          await reload();
          return;
        }

        const series = tasks.find((item) => item.id === task.sourceTaskId);

        if (!series) return;

        await repository.upsert({
          ...series,
          exceptionDates: [...new Set([...(series.exceptionDates ?? []), task.occurrenceDate])].sort(),
          updatedAt: new Date().toISOString(),
        });
        await reload();
      } catch (error) {
        throw setOperationError('No pudimos eliminar la ocurrencia.', error, setTaskError);
      }
    },
    [reload, repository, tasks],
  );

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => !task.completed).length;
    return { total: tasks.length, pending, completed: tasks.length - pending };
  }, [tasks]);

  return {
    tasks,
    isLoading,
    stats,
    taskRepositoryMode,
    taskError,
    clearTaskError: () => setTaskError(''),
    createTask,
    updateTask,
    deleteTask,
    deleteOccurrence,
    toggleTaskCompleted,
  };
}

function setOperationError(prefix: string, error: unknown, setTaskError: (message: string) => void) {
  const message = `${prefix} ${errorMessage(error)}`;
  setTaskError(message);
  return new Error(message);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
