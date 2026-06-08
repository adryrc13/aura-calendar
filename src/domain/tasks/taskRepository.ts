import type { Task } from './task';

export interface TaskRepository {
  getAll(): Promise<Task[]>;
  upsert(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
}
