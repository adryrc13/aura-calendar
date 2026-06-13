import { useEffect } from 'react';
import type { Task } from '../../domain/tasks/task';
import { useI18n } from '../../shared/i18n';
import { showBrowserNotification } from './browserNotifications';

function toReminderTimestamp(task: Task) {
  const startsAt = new Date(`${task.date}T${task.time}:00`);
  return startsAt.getTime() - task.reminderMinutesBefore * 60_000;
}

export function useReminderScheduler(tasks: Task[]) {
  const { t } = useI18n();

  useEffect(() => {
    const now = Date.now();
    const timeouts = tasks
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
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [tasks, t]);
}
