export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return Notification.permission;
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export function triggerSystemNotification(title: string, options: { body: string; tag?: string }) {
  // Trigger mobile vibration if available
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([300, 150, 300, 150, 600]);
    } catch {
      // ignore
    }
  }

  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: options.body,
        icon: '/favicon.ico',
        tag: options.tag || 'sync-minds-alert',
        requireInteraction: true,
      });
    } catch (err) {
      console.warn('Could not dispatch browser notification:', err);
    }
  }
}
