import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Task } from '../../domain/tasks/task';
import type { TaskRepository } from '../../domain/tasks/taskRepository';
import { dexieTaskRepository } from '../db/dexieTaskRepository';
import { getSupabaseClient } from './supabaseClient';
import {
  isUuid,
  shouldCreateDefaultCalendar,
  shouldSkipMigratedTask,
  supabaseRowToTask,
  taskToSupabaseRow,
  type SupabaseCalendarRow,
  type SupabaseTaskRow,
} from './supabaseTaskMapper';
import { createId } from '../../shared/id';

export interface TaskMigrationSummary {
  tasksFound: number;
  tasksUploaded: number;
  tasksSkipped: number;
  errors: string[];
  tasksWithLocalAttachments: number;
  note: string;
}

const DEFAULT_CALENDAR_STORAGE_PREFIX = 'aura-calendar:default-calendar:';
const TASK_MIGRATION_STORAGE_PREFIX = 'aura-calendar:task-migration:';
const ATTACHMENTS_PHASE_4C_NOTE = 'Los adjuntos se sincronizarán en la Fase 4C.';

export const supabaseTaskRepository: TaskRepository = {
  async getAll() {
    const client = requireSupabaseClient();
    const user = await requireSupabaseUser(client);
    await ensureDefaultRemoteCalendar(client, user);

    const { data, error } = await client
      .from('tasks')
      .select('*')
      .eq('owner_id', user.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      throw new Error(`No pudimos leer las tareas remotas: ${error.message}`);
    }

    return ((data ?? []) as SupabaseTaskRow[]).map(supabaseRowToTask);
  },

  async upsert(task: Task) {
    const client = requireSupabaseClient();
    const user = await requireSupabaseUser(client);
    const calendar = await ensureDefaultRemoteCalendar(client, user);
    const row = taskToSupabaseRow(task, user.id, task.calendarId ?? calendar.id);

    const { error } = await client.from('tasks').upsert(row, { onConflict: 'id' });

    if (error) {
      throw new Error(`No pudimos guardar la tarea en Supabase: ${error.message}`);
    }
  },

  async delete(id: string) {
    const client = requireSupabaseClient();
    const user = await requireSupabaseUser(client);
    const { error } = await client.from('tasks').delete().eq('id', id).eq('owner_id', user.id);

    if (error) {
      throw new Error(`No pudimos eliminar la tarea remota: ${error.message}`);
    }
  },
};

export async function ensureDefaultRemoteCalendar(client = requireSupabaseClient(), user?: User): Promise<SupabaseCalendarRow> {
  const currentUser = user ?? (await requireSupabaseUser(client));
  const cachedCalendarId = readStoredDefaultCalendarId(currentUser.id);

  if (cachedCalendarId) {
    const { data, error } = await client
      .from('calendars')
      .select('*')
      .eq('id', cachedCalendarId)
      .eq('owner_id', currentUser.id)
      .maybeSingle();

    if (!error && data) {
      return data as SupabaseCalendarRow;
    }
  }

  const { data: calendars, error: readError } = await client
    .from('calendars')
    .select('*')
    .eq('owner_id', currentUser.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (readError) {
    throw new Error(`No pudimos comprobar el calendario remoto: ${readError.message}`);
  }

  if (!shouldCreateDefaultCalendar((calendars ?? []) as SupabaseCalendarRow[])) {
    const calendar = (calendars as SupabaseCalendarRow[])[0];
    storeDefaultCalendarId(currentUser.id, calendar.id);
    return calendar;
  }

  const { data: createdCalendar, error: createError } = await client
    .from('calendars')
    .insert({
      owner_id: currentUser.id,
      name: 'Personal',
      description: null,
      color: '#22d3ee',
    })
    .select('*')
    .single();

  if (createError || !createdCalendar) {
    throw new Error(`No pudimos crear el calendario remoto Personal: ${createError?.message ?? 'respuesta vacía'}`);
  }

  const calendar = createdCalendar as SupabaseCalendarRow;
  storeDefaultCalendarId(currentUser.id, calendar.id);
  return calendar;
}

export async function activateRemoteTaskSync() {
  const client = requireSupabaseClient();
  const user = await requireSupabaseUser(client);
  const calendar = await ensureDefaultRemoteCalendar(client, user);

  const { error } = await client.from('tasks').select('id').eq('owner_id', user.id).limit(1);

  if (error) {
    throw new Error(`Supabase está configurado, pero la lectura remota falló: ${error.message}`);
  }

  return calendar;
}

export async function migrateLocalTasksToSupabase(): Promise<TaskMigrationSummary> {
  const client = requireSupabaseClient();
  const user = await requireSupabaseUser(client);
  const calendar = await ensureDefaultRemoteCalendar(client, user);
  const localTasks = await dexieTaskRepository.getAll();
  const { data: remoteTasks, error: remoteReadError } = await client
    .from('tasks')
    .select('id')
    .eq('owner_id', user.id);

  if (remoteReadError) {
    throw new Error(`No pudimos comprobar duplicados remotos: ${remoteReadError.message}`);
  }

  const existingRemoteIds = new Set(((remoteTasks ?? []) as Array<{ id: string }>).map((task) => task.id));
  const migratedLocalToRemoteIds = readMigratedTaskMap(user.id);
  const summary: TaskMigrationSummary = {
    tasksFound: localTasks.length,
    tasksUploaded: 0,
    tasksSkipped: 0,
    errors: [],
    tasksWithLocalAttachments: localTasks.filter((task) => (task.attachments ?? []).length > 0).length,
    note: ATTACHMENTS_PHASE_4C_NOTE,
  };

  for (const task of localTasks) {
    if (shouldSkipMigratedTask(task.id, { existingRemoteIds, migratedLocalToRemoteIds })) {
      summary.tasksSkipped += 1;
      continue;
    }

    const remoteId = resolveMigrationRemoteId(task.id, migratedLocalToRemoteIds[task.id]);
    const remoteTask: Task = {
      ...task,
      id: remoteId,
      calendarId: calendar.id,
      ownerId: user.id,
      attachments: [],
    };

    const { error } = await client.from('tasks').upsert(taskToSupabaseRow(remoteTask, user.id, calendar.id, remoteId), {
      onConflict: 'id',
    });

    if (error) {
      summary.errors.push(`${task.title || task.id}: ${error.message}`);
      continue;
    }

    migratedLocalToRemoteIds[task.id] = remoteId;
    existingRemoteIds.add(remoteId);
    summary.tasksUploaded += 1;
  }

  storeMigratedTaskMap(user.id, migratedLocalToRemoteIds);
  return summary;
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error('Supabase no configurado. Revisá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }

  return client;
}

async function requireSupabaseUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(`No pudimos validar la sesión de Supabase: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('No hay sesión activa. Iniciá sesión antes de usar sincronización remota.');
  }

  return data.user;
}

function resolveMigrationRemoteId(localTaskId: string, storedRemoteId?: string) {
  if (storedRemoteId && isUuid(storedRemoteId)) {
    return storedRemoteId;
  }

  if (isUuid(localTaskId)) {
    return localTaskId;
  }

  return createId();
}

function readStoredDefaultCalendarId(userId: string) {
  return readLocalStorage(`${DEFAULT_CALENDAR_STORAGE_PREFIX}${userId}`);
}

function storeDefaultCalendarId(userId: string, calendarId: string) {
  writeLocalStorage(`${DEFAULT_CALENDAR_STORAGE_PREFIX}${userId}`, calendarId);
}

function readMigratedTaskMap(userId: string): Record<string, string> {
  const raw = readLocalStorage(`${TASK_MIGRATION_STORAGE_PREFIX}${userId}`);

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function storeMigratedTaskMap(userId: string, map: Record<string, string>) {
  writeLocalStorage(`${TASK_MIGRATION_STORAGE_PREFIX}${userId}`, JSON.stringify(map));
}

function readLocalStorage(key: string) {
  if (typeof localStorage === 'undefined') return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(key, value);
  } catch {
    // Si el navegador bloquea storage, la sincronización sigue funcionando sin cache local.
  }
}
