export const NOTIFICATION_READ_EVENT = 'ep:notification-read';
export const NOTIFICATIONS_READ_ALL_EVENT = 'ep:notifications-read-all';
/** Push FCM en primer plano (o cualquier origen) — pide refrescar la bandeja. */
export const NOTIFICATIONS_REFRESH_REQUEST_EVENT = 'ep:notifications-refresh-request';

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
