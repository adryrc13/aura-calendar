import Dexie, { type Table } from 'dexie';
import type { Task } from '../../domain/tasks/task';
import type { TaskAttachment } from '../../domain/tasks/attachment';

export type PersistedTask = Omit<Task, 'attachments'>;

export class AuraDatabase extends Dexie {
  tasks!: Table<PersistedTask, string>;
  taskAttachments!: Table<TaskAttachment, string>;

  constructor() {
    super('aura-calendar-local-db');
    this.version(1).stores({
      tasks: 'id, date, completed, updatedAt',
    });

    this.version(2).stores({
      tasks: 'id, date, completed, updatedAt, recurrenceType, parentTaskId',
    });

    this.version(3).stores({
      tasks: 'id, date, completed, updatedAt, recurrenceType, parentTaskId',
      taskAttachments: 'id, taskId, type, updatedAt',
    });
  }
}

export const auraDb = new AuraDatabase();
