import type { TaskRepository } from '../../domain/tasks/taskRepository';

const PHASE_4A_MESSAGE = 'La sincronización remota de tareas se activará en la siguiente fase.';

export const supabaseTaskRepository: TaskRepository = {
  async getAll() {
    throw new Error(PHASE_4A_MESSAGE);
  },

  async upsert() {
    throw new Error(PHASE_4A_MESSAGE);
  },

  async delete() {
    throw new Error(PHASE_4A_MESSAGE);
  },
};
