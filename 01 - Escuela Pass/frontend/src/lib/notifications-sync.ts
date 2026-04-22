export const NOTIFICATION_READ_EVENT = 'ep:notification-read';
export const NOTIFICATIONS_READ_ALL_EVENT = 'ep:notifications-read-all';

export function emitNotificationRead(notificationId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ notificationId: string }>(NOTIFICATION_READ_EVENT, {
      detail: { notificationId }
    })
  );
}

export function emitNotificationsReadAll(notificationIds: string[]) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ notificationIds: string[] }>(NOTIFICATIONS_READ_ALL_EVENT, {
      detail: { notificationIds }
    })
  );
}
