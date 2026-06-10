import { normalizeTaskAttachments } from '../../domain/tasks/attachment';
import type { Task } from '../../domain/tasks/task';
import type { TaskRepository } from '../../domain/tasks/taskRepository';
import { auraDb, type PersistedTask } from './auraDb';

export const dexieTaskRepository: TaskRepository = {
  async getAll() {
    const [tasks, attachments] = await Promise.all([auraDb.tasks.toArray(), auraDb.taskAttachments.toArray()]);
    const attachmentsByTask = new Map<string, Task['attachments']>();

    for (const attachment of attachments) {
      const current = attachmentsByTask.get(attachment.taskId) ?? [];
      current.push(attachment);
      attachmentsByTask.set(attachment.taskId, current);
    }

    return tasks
      .map<Task>((task) => ({
        ...task,
        attachments: normalizeTaskAttachments([...(attachmentsByTask.get(task.id) ?? [])], task.id, task.updatedAt).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
      }))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  },

  async upsert(task: Task) {
    const { attachments: rawAttachments, ...persistedTask } = task;
    const attachments = normalizeTaskAttachments(rawAttachments, task.id, task.updatedAt);

    await auraDb.transaction('rw', auraDb.tasks, auraDb.taskAttachments, async () => {
      await auraDb.tasks.put(persistedTask as PersistedTask);
      await auraDb.taskAttachments.where('taskId').equals(task.id).delete();

      if (attachments.length) {
        await auraDb.taskAttachments.bulkPut(attachments);
      }
    });
  },

  async delete(id: string) {
    await auraDb.transaction('rw', auraDb.tasks, auraDb.taskAttachments, async () => {
      await auraDb.tasks.delete(id);
      await auraDb.taskAttachments.where('taskId').equals(id).delete();
    });
  },
};
