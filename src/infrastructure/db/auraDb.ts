import Dexie, { type Table } from 'dexie';
import type { Task } from '../../domain/tasks/task';

export class AuraDatabase extends Dexie {
  tasks!: Table<Task, string>;

  constructor() {
    super('aura-calendar-local-db');
    this.version(1).stores({
      tasks: 'id, date, completed, updatedAt',
    });

    this.version(2).stores({
      tasks: 'id, date, completed, updatedAt, recurrenceType, parentTaskId',
    });
  }
}

export const auraDb = new AuraDatabase();
