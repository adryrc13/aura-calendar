import type { Task } from '../../domain/tasks/task';
import { DEFAULT_TASK_DRAFT } from '../../domain/tasks/task';
import {
  shouldCreateDefaultCalendar,
  shouldSkipMigratedTask,
  supabaseRowToTask,
  taskToSupabaseRow,
  type SupabaseCalendarRow,
  type SupabaseTaskRow,
} from './supabaseTaskMapper';

const NOW = '2026-06-12T10:00:00.000Z';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CALENDAR_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    ...DEFAULT_TASK_DRAFT,
    id: TASK_ID,
    calendarId: CALENDAR_ID,
    ownerId: OWNER_ID,
    title: 'Entrenar',
    description: 'Rutina semanal',
    date: '2026-06-16',
    time: '18:00',
    endTime: '19:00',
    completed: false,
    color: 'cyan',
    textColor: '#0c1830',
    reminderEnabled: true,
    reminderMinutesBefore: 30,
    reminderSilent: false,
    recurrenceType: 'weekdays',
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: [2, 4],
    exceptionDates: ['2026-06-23'],
    modifiedOccurrences: {
      '2026-06-25': { completed: true },
    },
    attachments: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRow(overrides: Partial<SupabaseTaskRow> = {}): SupabaseTaskRow {
  return {
    id: TASK_ID,
    calendar_id: CALENDAR_ID,
    owner_id: OWNER_ID,
    title: 'Entrenar',
    description: 'Rutina semanal',
    date: '2026-06-16',
    time: '18:00',
    end_time: '19:00',
    completed: false,
    color: 'cyan',
    text_color: '#0c1830',
    reminder_enabled: true,
    reminder_minutes_before: 30,
    reminder_silent: false,
    recurrence_type: 'weekdays',
    recurrence_interval: 1,
    recurrence_days_of_week: [2, 4],
    recurrence_days_of_month: [],
    recurrence_end_date: null,
    recurrence_count: null,
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH',
    parent_task_id: null,
    exception_dates: ['2026-06-23'],
    modified_occurrences: {
      '2026-06-25': { completed: true },
    },
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeCalendar(overrides: Partial<SupabaseCalendarRow> = {}): SupabaseCalendarRow {
  return {
    id: CALENDAR_ID,
    owner_id: OWNER_ID,
    name: 'Personal',
    description: null,
    color: '#22d3ee',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function runSupabaseTaskMapperInternalTests() {
  const task = makeTask();
  const row = taskToSupabaseRow(task, OWNER_ID, CALENDAR_ID);
  const mappedBack = supabaseRowToTask(makeRow());
  const duplicateLookup = {
    existingRemoteIds: new Set([TASK_ID, '44444444-4444-4444-8444-444444444444']),
    migratedLocalToRemoteIds: {
      'local-only': '44444444-4444-4444-8444-444444444444',
    },
  };
  const parsedAssistantTask = makeTask({ title: 'Tomar medicación', reminderEnabled: true, reminderMinutesBefore: 10 });

  return [
    {
      name: 'mapear tarea local a tarea Supabase',
      ok:
        row.id === TASK_ID &&
        row.calendar_id === CALENDAR_ID &&
        row.owner_id === OWNER_ID &&
        row.end_time === '19:00' &&
        row.recurrence_days_of_week instanceof Array &&
        row.exception_dates instanceof Array,
    },
    {
      name: 'mapear tarea Supabase a tarea local',
      ok:
        mappedBack.id === TASK_ID &&
        mappedBack.calendarId === CALENDAR_ID &&
        mappedBack.ownerId === OWNER_ID &&
        mappedBack.recurrenceType === 'weekdays' &&
        mappedBack.recurrenceDaysOfWeek.join('|') === '2|4' &&
        mappedBack.attachments.length === 0,
    },
    {
      name: 'crear calendario remoto por defecto cuando no existe',
      ok: shouldCreateDefaultCalendar([]) && !shouldCreateDefaultCalendar([makeCalendar()]),
    },
    {
      name: 'evitar duplicados en migración',
      ok: shouldSkipMigratedTask(TASK_ID, duplicateLookup) && shouldSkipMigratedTask('local-only', duplicateLookup),
    },
    {
      name: 'tarea recurrente con días de semana',
      ok: row.recurrence_type === 'weekdays' && JSON.stringify(row.recurrence_days_of_week) === '[2,4]',
    },
    {
      name: 'tarea con recordatorio',
      ok: row.reminder_enabled === true && row.reminder_minutes_before === 30 && row.reminder_silent === false,
    },
    {
      name: 'tarea creada por asistente conserva campos sincronizables',
      ok:
        taskToSupabaseRow(parsedAssistantTask, OWNER_ID, CALENDAR_ID).title === 'Tomar medicación' &&
        taskToSupabaseRow(parsedAssistantTask, OWNER_ID, CALENDAR_ID).reminder_minutes_before === 10,
    },
  ];
}
