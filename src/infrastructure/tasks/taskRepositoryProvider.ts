import type { TaskRepository } from '../../domain/tasks/taskRepository';
import { dexieTaskRepository } from '../db/dexieTaskRepository';
import { supabaseTaskRepository } from '../supabase/supabaseTaskRepository';

export type TaskRepositoryMode = 'local' | 'remote';

export const taskRepositories: Record<TaskRepositoryMode, TaskRepository> = {
  local: dexieTaskRepository,
  remote: supabaseTaskRepository,
};

export const activeTaskRepositoryMode: TaskRepositoryMode = 'local';

export function getActiveTaskRepository() {
  return taskRepositories[activeTaskRepositoryMode];
}
