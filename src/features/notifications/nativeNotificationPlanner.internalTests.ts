import type { Task } from '../../domain/tasks/task';
import {
  buildReminderReconciliationPlan,
  buildTaskReminderPlan,
  taskReminderNotificationId,
} from './nativeNotificationPlanner';

const NOW = new Date('2026-06-25T10:00:00');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    calendarId: 'calendar-1',
    title: 'Tomar medicación',
    description: '',
    date: '2026-06-25',
    time: '11:00',
    completed: false,
    color: 'cyan',
    textColor: '#0c1830',
    reminderEnabled: true,
    reminderMinutesBefore: 10,
    reminderSilent: false,
    recurrenceType: 'none',
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: [],
    recurrenceDaysOfMonth: [],
    recurrenceEndDate: undefined,
    recurrenceCount: undefined,
    recurrenceRule: undefined,
    parentTaskId: undefined,
    exceptionDates: [],
    modifiedOccurrences: {},
    attachments: [],
    occurrenceDate: undefined,
    sourceTaskId: undefined,
    isVirtualOccurrence: undefined,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

export function runNativeNotificationPlannerInternalTests() {
  const notificationId = taskReminderNotificationId('task-1');
  const editedTask = makeTask({ time: '12:00' });
  const recurrentTask = makeTask({
    id: 'series-1',
    date: '2026-06-20',
    time: '09:00',
    recurrenceType: 'daily',
  });
  const recurrentPlan = buildTaskReminderPlan(recurrentTask, NOW).plan;

  return [
    {
      name: 'notificationId de recordatorio es estable',
      ok: notificationId === taskReminderNotificationId('task-1') && notificationId !== taskReminderNotificationId('task-2'),
    },
    {
      name: 'no programa tareas sin fecha u hora válida',
      ok: buildTaskReminderPlan(makeTask({ time: '' }), NOW).skipReason === 'invalid-date-time',
    },
    {
      name: 'no programa recordatorios en el pasado',
      ok: buildTaskReminderPlan(makeTask({ time: '09:00' }), NOW).skipReason === 'past',
    },
    {
      name: 'cancelación al eliminar tarea pendiente',
      ok: buildReminderReconciliationPlan([], [notificationId], NOW).cancelNotificationIds.includes(notificationId),
    },
    {
      name: 'reprogramación al editar conserva el mismo notificationId',
      ok:
        buildReminderReconciliationPlan([editedTask], [notificationId], NOW).cancelNotificationIds.includes(notificationId) &&
        buildReminderReconciliationPlan([editedTask], [notificationId], NOW).schedulePlans[0]?.notificationId === notificationId,
    },
    {
      name: 'tarea completada cancela recordatorio pendiente',
      ok: buildReminderReconciliationPlan([makeTask({ completed: true })], [notificationId], NOW).cancelNotificationIds.includes(notificationId),
    },
    {
      name: 'recurrente programa solo próxima ocurrencia futura',
      ok:
        recurrentPlan?.sourceTaskId === 'series-1' &&
        recurrentPlan.occurrenceDate === '2026-06-26' &&
        recurrentPlan.notificationId === taskReminderNotificationId('series-1'),
    },
  ];
}
