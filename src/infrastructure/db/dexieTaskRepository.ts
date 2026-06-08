import type { Task } from '../../domain/tasks/task';
import type { TaskRepository } from '../../domain/tasks/taskRepository';
import { auraDb } from './auraDb';

export const dexieTaskRepository: TaskRepository = {
  async getAll() {
    const tasks = await auraDb.tasks.toArray();
    return tasks.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  },

  async upsert(task: Task) {
    await auraDb.tasks.put(task);
  },

  async delete(id: string) {
    await auraDb.tasks.delete(id);
  },
};
