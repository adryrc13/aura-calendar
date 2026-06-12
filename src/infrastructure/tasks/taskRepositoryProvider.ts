import type { TaskRepository } from '../../domain/tasks/taskRepository';
import { dexieTaskRepository } from '../db/dexieTaskRepository';
import { supabaseTaskRepository } from '../supabase/supabaseTaskRepository';

export type TaskRepositoryMode = 'local' | 'remote';

const TASK_REPOSITORY_MODE_STORAGE_KEY = 'aura-calendar:task-repository-mode';
const TASK_REPOSITORY_MODE_EVENT = 'aura-calendar:task-repository-mode-change';

export const taskRepositories: Record<TaskRepositoryMode, TaskRepository> = {
  local: dexieTaskRepository,
  remote: supabaseTaskRepository,
};

export const activeTaskRepositoryMode: TaskRepositoryMode = getTaskRepositoryMode();

export function getActiveTaskRepository() {
  return getTaskRepository();
}

export function getTaskRepository(mode: TaskRepositoryMode = getTaskRepositoryMode()) {
  return taskRepositories[mode];
}

export function getTaskRepositoryMode(): TaskRepositoryMode {
  if (typeof localStorage === 'undefined') return 'local';

  try {
    const storedMode = localStorage.getItem(TASK_REPOSITORY_MODE_STORAGE_KEY);
    return isTaskRepositoryMode(storedMode) ? storedMode : 'local';
  } catch {
    return 'local';
  }
}

export function setTaskRepositoryMode(mode: TaskRepositoryMode) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(TASK_REPOSITORY_MODE_STORAGE_KEY, mode);
    } catch {
      // Si localStorage falla, el evento igual mantiene la UI actualizada en memoria.
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<TaskRepositoryMode>(TASK_REPOSITORY_MODE_EVENT, { detail: mode }));
  }
}

export function subscribeTaskRepositoryModeChange(listener: (mode: TaskRepositoryMode) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleModeEvent = (event: Event) => {
    const nextMode = event instanceof CustomEvent ? event.detail : getTaskRepositoryMode();
    if (isTaskRepositoryMode(nextMode)) {
      listener(nextMode);
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === TASK_REPOSITORY_MODE_STORAGE_KEY) {
      listener(isTaskRepositoryMode(event.newValue) ? event.newValue : 'local');
    }
  };

  window.addEventListener(TASK_REPOSITORY_MODE_EVENT, handleModeEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(TASK_REPOSITORY_MODE_EVENT, handleModeEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

function isTaskRepositoryMode(value: unknown): value is TaskRepositoryMode {
  return value === 'local' || value === 'remote';
}
