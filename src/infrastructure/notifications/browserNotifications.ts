export type NotificationPermissionState = NotificationPermission | 'unsupported';

export function getNotificationPermission(): NotificationPermissionState {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, body?: string, silent = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  new Notification(title, {
    body,
    silent,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  });

  return true;
}
