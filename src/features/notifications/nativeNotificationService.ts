import { Capacitor, type PermissionState } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Task } from '../../domain/tasks/task';
import {
  AURA_NOTIFICATION_SOURCE,
  AURA_REMINDERS_CHANNEL_ID,
  buildReminderReconciliationPlan,
  buildTaskReminderPlan,
  taskReminderNotificationId,
  type TaskReminderPlan,
} from './nativeNotificationPlanner';
import {
  getNotificationPermission,
  requestNotificationPermission as requestBrowserNotificationPermission,
  showBrowserNotification,
  type NotificationPermissionState,
} from '../../infrastructure/notifications/browserNotifications';

export type NativeNotificationPermissionState = PermissionState | NotificationPermissionState | 'unsupported';
export type NativeExactAlarmPermissionState = PermissionState | 'unsupported';

export interface ScheduleReminderResult {
  status: 'scheduled' | 'skipped';
  reason?: string;
  notificationId?: number;
  reminderAt?: Date;
}

export function isNativeNotificationsAvailable() {
  return isNativeAndroid() || getNotificationPermission() !== 'unsupported';
}

export function isNativeAndroidNotificationsRuntime() {
  return isNativeAndroid();
}

export async function checkNotificationPermission(): Promise<NativeNotificationPermissionState> {
  if (!isNativeAndroid()) {
    return getNotificationPermission();
  }

  try {
    return (await LocalNotifications.checkPermissions()).display;
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<NativeNotificationPermissionState> {
  if (!isNativeAndroid()) {
    return requestBrowserNotificationPermission();
  }

  try {
    return (await LocalNotifications.requestPermissions()).display;
  } catch {
    return 'unsupported';
  }
}

export async function checkExactAlarmPermission(): Promise<NativeExactAlarmPermissionState> {
  if (!isNativeAndroid()) return 'unsupported';

  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
  } catch {
    return 'unsupported';
  }
}

export async function requestExactAlarmPermission(): Promise<NativeExactAlarmPermissionState> {
  if (!isNativeAndroid()) return 'unsupported';

  try {
    return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm;
  } catch {
    return 'unsupported';
  }
}

export async function scheduleTaskReminder(task: Task): Promise<ScheduleReminderResult> {
  if (!isNativeAndroid()) return { status: 'skipped', reason: 'web-browser-scheduler' };

  const plan = buildTaskReminderPlan(task).plan;
  if (!plan) return { status: 'skipped', reason: 'not-schedulable' };

  return scheduleReminderPlan(plan);
}

export async function cancelTaskReminder(taskId: string) {
  if (!isNativeAndroid()) return;

  await LocalNotifications.cancel({
    notifications: [{ id: taskReminderNotificationId(taskId) }],
  });
}

export async function rescheduleTaskReminder(task: Task) {
  await cancelTaskReminder(task.sourceTaskId ?? task.id);
  return scheduleTaskReminder(task);
}

export async function cancelAllTaskReminders() {
  if (!isNativeAndroid()) return;

  const pendingIds = await getPendingAuraTaskReminderIds();
  if (!pendingIds.length) return;

  await LocalNotifications.cancel({ notifications: pendingIds.map((id) => ({ id })) });
}

export async function reconcileTaskReminders(tasks: Task[]) {
  if (!isNativeAndroid()) return;

  const pendingIds = await getPendingAuraTaskReminderIds();
  const reconciliation = buildReminderReconciliationPlan(tasks, pendingIds);

  if (reconciliation.cancelNotificationIds.length) {
    await LocalNotifications.cancel({
      notifications: reconciliation.cancelNotificationIds.map((id) => ({ id })),
    });
  }

  for (const plan of reconciliation.schedulePlans) {
    await scheduleReminderPlan(plan);
  }
}

export async function scheduleTestNotification(title: string, body: string, delaySeconds = 10) {
  if (!isNativeAndroid()) {
    window.setTimeout(() => showBrowserNotification(title, body), delaySeconds * 1000);
    return { status: 'scheduled' as const };
  }

  const display = await requestNotificationPermission();
  if (display !== 'granted') return { status: 'skipped' as const, reason: 'permission-denied' };

  await ensureReminderChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 100_000,
        title,
        body,
        channelId: AURA_REMINDERS_CHANNEL_ID,
        schedule: { at: new Date(Date.now() + delaySeconds * 1000) },
        autoCancel: true,
        extra: { source: AURA_NOTIFICATION_SOURCE, type: 'test' },
      },
    ],
  });

  return { status: 'scheduled' as const };
}

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function scheduleReminderPlan(plan: TaskReminderPlan): Promise<ScheduleReminderResult> {
  const display = await checkNotificationPermission();
  if (display !== 'granted') return { status: 'skipped', reason: 'permission-denied', notificationId: plan.notificationId };

  const exactAlarm = await checkExactAlarmPermission();
  if (exactAlarm === 'denied') return { status: 'skipped', reason: 'exact-alarm-denied', notificationId: plan.notificationId };

  await ensureReminderChannel();
  await LocalNotifications.cancel({ notifications: [{ id: plan.notificationId }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: plan.notificationId,
        title: plan.title,
        body: plan.body,
        channelId: AURA_REMINDERS_CHANNEL_ID,
        schedule: {
          at: plan.reminderAt,
          allowWhileIdle: true,
        },
        autoCancel: true,
        extra: {
          source: AURA_NOTIFICATION_SOURCE,
          type: 'task-reminder',
          taskId: plan.sourceTaskId,
          occurrenceTaskId: plan.taskId,
          occurrenceDate: plan.occurrenceDate,
          calendarId: plan.calendarId,
        },
      },
    ],
  });

  return {
    status: 'scheduled',
    notificationId: plan.notificationId,
    reminderAt: plan.reminderAt,
  };
}

async function ensureReminderChannel() {
  await LocalNotifications.createChannel({
    id: AURA_REMINDERS_CHANNEL_ID,
    name: 'Aura reminders / Recordatorios Aura',
    description: 'Task reminders / Recordatorios de tareas',
    importance: 4,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#22d3ee',
  });
}

async function getPendingAuraTaskReminderIds() {
  const pending = await LocalNotifications.getPending();

  return pending.notifications
    .filter((notification) => notification.extra?.source === AURA_NOTIFICATION_SOURCE && notification.extra?.type === 'task-reminder')
    .map((notification) => notification.id);
}
