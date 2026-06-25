import { useEffect } from 'react';
import type { Task } from '../../domain/tasks/task';
import { expandTasksInRange } from '../../domain/tasks/recurrence';
import { addDays, todayInputValue, toDateInputValue } from '../../shared/date';
import { useI18n } from '../../shared/i18n';
import { isNativeAndroidNotificationsRuntime, reconcileTaskReminders } from '../../features/notifications/nativeNotificationService';
import { showBrowserNotification } from './browserNotifications';

function toReminderTimestamp(task: Task) {
  const startsAt = new Date(`${task.date}T${task.time}:00`);
  return startsAt.getTime() - task.reminderMinutesBefore * 60_000;
}

export function useReminderScheduler(tasks: Task[]) {
  const { t } = useI18n();

  useEffect(() => {
    let isActive = true;

    if (isNativeAndroidNotificationsRuntime()) {
      const reconcile = () => reconcileTaskReminders(tasks).catch((error) => {
        if (isActive) {
          console.warn('No se pudieron reconciliar las notificaciones nativas.', error);
        }
      });

      reconcile();
      window.addEventListener('aura:notification-permission-changed', reconcile);
      document.addEventListener('visibilitychange', reconcile);

      return () => {
        isActive = false;
        window.removeEventListener('aura:notification-permission-changed', reconcile);
        document.removeEventListener('visibilitychange', reconcile);
      };
    }

    const now = Date.now();
    const browserReminderTasks = expandTasksInRange(tasks, {
      start: todayInputValue(),
      end: toDateInputValue(addDays(new Date(), 31)),
    });
    const timeouts = browserReminderTasks
      .filter((task) => task.reminderEnabled && !task.completed)
      .map((task) => {
        const delay = toReminderTimestamp(task) - now;

        if (delay <= 0 || delay > 2_147_483_647) {
          return undefined;
        }

        // Fase 1: estos recordatorios viven en memoria y solo son razonables mientras la PWA está abierta.
        // En Android, las notificaciones fiables con la app cerrada se implementarán luego con Capacitor
        // Local Notifications, porque el navegador no garantiza ejecución exacta en background.
        return window.setTimeout(() => {
          showBrowserNotification(
            t('notifications.reminderTitle', { title: task.title }),
            t('notifications.reminderBody', { time: task.time, description: task.description }),
            task.reminderSilent,
          );
        }, delay);
      })
      .filter((timeoutId): timeoutId is number => typeof timeoutId === 'number');

    return () => {
      isActive = false;
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [tasks, t]);
}
