import { addDays, toDateInputValue } from '../../shared/date';
import type { Task } from '../../domain/tasks/task';
import { expandTaskOccurrences, isRecurringTask } from '../../domain/tasks/recurrence';

export const AURA_REMINDERS_CHANNEL_ID = 'aura-reminders';
export const AURA_NOTIFICATION_SOURCE = 'aura-calendar';
const MAX_RECURRENCE_LOOKAHEAD_DAYS = 366;

export type ReminderSkipReason = 'disabled' | 'completed' | 'invalid-date-time' | 'past';

export interface TaskReminderPlan {
  notificationId: number;
  taskId: string;
  sourceTaskId: string;
  calendarId?: string;
  title: string;
  body: string;
  reminderAt: Date;
  occurrenceDate: string;
}

export interface ReminderPlanResult {
  plan?: TaskReminderPlan;
  skipReason?: ReminderSkipReason;
}

export interface ReminderReconciliationPlan {
  cancelNotificationIds: number[];
  schedulePlans: TaskReminderPlan[];
}

export function taskReminderNotificationId(taskId: string) {
  const hash = fnv1a32(`task-reminder:${taskId}`);
  return (hash & 0x7fffffff) || 1;
}

export function buildTaskReminderPlan(task: Task, now = new Date()): ReminderPlanResult {
  if (!task.reminderEnabled) return { skipReason: 'disabled' };
  if (task.completed) return { skipReason: 'completed' };

  const occurrence = findNextReminderOccurrence(task, now);
  if (!occurrence) return { skipReason: isValidDateTime(task.date, task.time) ? 'past' : 'invalid-date-time' };

  const reminderAt = reminderDateFor(occurrence);
  if (!reminderAt || reminderAt.getTime() <= now.getTime()) return { skipReason: 'past' };

  const sourceTaskId = occurrence.sourceTaskId ?? task.id;

  return {
    plan: {
      notificationId: taskReminderNotificationId(sourceTaskId),
      taskId: occurrence.id,
      sourceTaskId,
      calendarId: occurrence.calendarId,
      title: occurrence.title,
      body: `${occurrence.date} · ${occurrence.time}`,
      reminderAt,
      occurrenceDate: occurrence.occurrenceDate ?? occurrence.date,
    },
  };
}

export function buildReminderReconciliationPlan(tasks: Task[], pendingNotificationIds: number[], now = new Date()): ReminderReconciliationPlan {
  const schedulePlans = tasks
    .map((task) => buildTaskReminderPlan(task, now).plan)
    .filter((plan): plan is TaskReminderPlan => Boolean(plan));
  const desiredIds = new Set(schedulePlans.map((plan) => plan.notificationId));
  const pendingIds = new Set(pendingNotificationIds);
  const cancelNotificationIds = [...pendingIds].filter((id) => !desiredIds.has(id) || schedulePlans.some((plan) => plan.notificationId === id));

  return { cancelNotificationIds, schedulePlans };
}

function findNextReminderOccurrence(task: Task, now: Date) {
  if (!isRecurringTask(task)) {
    const reminderAt = reminderDateFor(task);
    return reminderAt && reminderAt.getTime() > now.getTime() ? task : undefined;
  }

  const range = {
    start: toDateInputValue(now),
    end: toDateInputValue(addDays(now, MAX_RECURRENCE_LOOKAHEAD_DAYS)),
  };

  return expandTaskOccurrences(task, range).find((occurrence) => !occurrence.completed && (reminderDateFor(occurrence)?.getTime() ?? 0) > now.getTime());
}

function reminderDateFor(task: Pick<Task, 'date' | 'time' | 'reminderMinutesBefore'>) {
  if (!isValidDateTime(task.date, task.time)) return undefined;

  const startsAt = new Date(`${task.date}T${task.time}:00`);
  return new Date(startsAt.getTime() - task.reminderMinutesBefore * 60_000);
}

function isValidDateTime(date: string, time: string) {
  if (!date || !time) return false;
  return !Number.isNaN(new Date(`${date}T${time}:00`).getTime());
}

function fnv1a32(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}
