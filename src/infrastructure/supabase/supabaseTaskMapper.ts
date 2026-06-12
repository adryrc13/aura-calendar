import type { ModifiedOccurrence, RecurrenceType, Task, TaskColor } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT, TASK_COLORS } from '../../domain/tasks/task';
import { createId } from '../../shared/id';

export interface SupabaseTaskRow {
  id: string;
  calendar_id: string | null;
  owner_id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  end_time: string | null;
  completed: boolean | null;
  color: string | null;
  text_color: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  reminder_silent: boolean | null;
  recurrence_type: string | null;
  recurrence_interval: number | null;
  recurrence_days_of_week: unknown;
  recurrence_days_of_month: unknown;
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  recurrence_rule: string | null;
  parent_task_id: string | null;
  exception_dates: unknown;
  modified_occurrences: unknown;
  created_at: string;
  updated_at: string;
}

export type SupabaseTaskUpsertRow = Omit<SupabaseTaskRow, 'calendar_id'> & {
  calendar_id: string;
};

export interface SupabaseCalendarRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface MigratedTaskLookup {
  existingRemoteIds: ReadonlySet<string>;
  migratedLocalToRemoteIds: Record<string, string>;
}

const RECURRENCE_TYPES: RecurrenceType[] = [
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'alternate-days',
  'custom-days',
  'custom-weeks',
  'weekdays',
  'month-days',
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function taskToSupabaseRow(task: Task, ownerId: string, calendarId: string, idOverride?: string): SupabaseTaskUpsertRow {
  const remoteId = idOverride ?? task.id;

  return {
    id: isUuid(remoteId) ? remoteId : createId(),
    calendar_id: calendarId,
    owner_id: ownerId,
    title: task.title,
    description: task.description ?? '',
    date: task.date,
    time: task.time,
    end_time: task.endTime ?? null,
    completed: task.completed,
    color: task.color,
    text_color: task.textColor,
    reminder_enabled: task.reminderEnabled,
    reminder_minutes_before: task.reminderMinutesBefore,
    reminder_silent: task.reminderSilent,
    recurrence_type: task.recurrenceType,
    recurrence_interval: task.recurrenceInterval,
    recurrence_days_of_week: task.recurrenceDaysOfWeek ?? [],
    recurrence_days_of_month: task.recurrenceDaysOfMonth ?? [],
    recurrence_end_date: task.recurrenceEndDate ?? null,
    recurrence_count: task.recurrenceCount ?? null,
    recurrence_rule: task.recurrenceRule ?? null,
    parent_task_id: isUuid(task.parentTaskId) ? task.parentTaskId : null,
    exception_dates: task.exceptionDates ?? [],
    modified_occurrences: task.modifiedOccurrences ?? {},
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export function supabaseRowToTask(row: SupabaseTaskRow): Task {
  const color = normalizeTaskColor(row.color);
  const recurrenceType = normalizeRecurrenceType(row.recurrence_type);

  return {
    ...DEFAULT_TASK_DRAFT,
    id: row.id,
    calendarId: row.calendar_id ?? undefined,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? '',
    date: row.date,
    time: row.time,
    endTime: row.end_time ?? undefined,
    completed: Boolean(row.completed),
    color,
    textColor: row.text_color ?? taskTextColor(color),
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderMinutesBefore: Math.max(0, Number(row.reminder_minutes_before ?? DEFAULT_TASK_DRAFT.reminderMinutesBefore)),
    reminderSilent: Boolean(row.reminder_silent),
    recurrenceType,
    recurrenceInterval: Math.max(1, Number(row.recurrence_interval ?? 1)),
    recurrenceDaysOfWeek: normalizeNumberArray(row.recurrence_days_of_week, 0, 6),
    recurrenceDaysOfMonth: normalizeNumberArray(row.recurrence_days_of_month, 1, 31),
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
    recurrenceCount: row.recurrence_count ?? undefined,
    recurrenceRule: row.recurrence_rule ?? undefined,
    parentTaskId: row.parent_task_id ?? undefined,
    exceptionDates: normalizeStringArray(row.exception_dates),
    modifiedOccurrences: normalizeModifiedOccurrences(row.modified_occurrences),
    attachments: [],
    occurrenceDate: undefined,
    sourceTaskId: undefined,
    isVirtualOccurrence: undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shouldCreateDefaultCalendar(existingCalendars: SupabaseCalendarRow[]) {
  return existingCalendars.length === 0;
}

export function shouldSkipMigratedTask(taskId: string, lookup: MigratedTaskLookup) {
  if (lookup.existingRemoteIds.has(taskId)) {
    return true;
  }

  const migratedRemoteId = lookup.migratedLocalToRemoteIds[taskId];

  return Boolean(migratedRemoteId && lookup.existingRemoteIds.has(migratedRemoteId));
}

function normalizeTaskColor(value: string | null): TaskColor {
  return TASK_COLORS.some((item) => item.value === value) ? (value as TaskColor) : 'cyan';
}

function taskTextColor(color: TaskColor) {
  return TASK_COLORS.find((item) => item.value === color)?.textColor ?? '#0c1830';
}

function normalizeRecurrenceType(value: string | null): RecurrenceType {
  return RECURRENCE_TYPES.includes(value as RecurrenceType) ? (value as RecurrenceType) : 'none';
}

function normalizeNumberArray(value: unknown, min: number, max: number) {
  return readArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= min && item <= max)
    .sort((a, b) => a - b);
}

function normalizeStringArray(value: unknown) {
  return readArray(value)
    .filter((item): item is string => typeof item === 'string')
    .sort();
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeModifiedOccurrences(value: unknown): Record<string, ModifiedOccurrence> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, ModifiedOccurrence>;
}
