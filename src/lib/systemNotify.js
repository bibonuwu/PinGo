// Системные уведомления устройства (Notification API). Пока данные локальные, они
// показываются, когда Pingo открыт хотя бы в одной вкладке или установленном приложении.

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showSystemNotification(title, { body, tag, url } = {}) {
  if (notificationPermission() !== 'granted') return;
  const options = { body, tag, icon: '/icons/icon-192.png', badge: '/favicon.png', data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      if (url) window.dispatchEvent(new CustomEvent('pingo:navigate', { detail: url }));
      n.close();
    };
  } catch {
    /* на некоторых платформах конструктор Notification недоступен — не критично */
  }
}
