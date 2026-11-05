import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db } from '../lib/db';
import { MINUTE, fmtTime } from '../lib/utils';
import { showSystemNotification } from '../lib/systemNotify';
import { useNow } from '../hooks/useNow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { notifyOnce } from '../services/notifications';
import { roomWindow } from '../services/bookings';
import { t } from '../i18n';
import { msg, notificationBody, notificationTitle } from '../i18n/stored';

// Новые уведомления: внутри приложения — тост, в фоне — системное уведомление устройства.
export function NotificationWatcher({ user }) {
  const toast = useToast();
  const navigate = useNavigate();
  const startedAt = useRef(Date.now());
  const seen = useRef(new Set());
  const latest = useLiveQuery(
    async () =>
      (await db.notifications.where('userId').equals(user.id).toArray())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6),
    [user.id],
  );

  useEffect(() => {
    if (!latest) return;
    for (const n of latest) {
      if (n.read || n.createdAt < startedAt.current || seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (document.visibilityState === 'visible') {
        toast.show(notificationBody(n), {
          title: notificationTitle(n),
          tone: 'info',
          duration: 6000,
          action: n.link ? { label: t('Открыть'), onClick: () => navigate(n.link) } : undefined,
        });
      } else {
        showSystemNotification(notificationTitle(n), { body: notificationBody(n), tag: n.id, url: n.link });
      }
    }
  }, [latest, toast, navigate]);

  return null;
}

// Напоминание «Видеокомната открыта» за 15 минут до подтверждённого онлайн-занятия.
export function ReminderWatcher({ user }) {
  const now = useNow(20_000);
  const bookings = useLiveQuery(
    () =>
      user.role === 'admin'
        ? []
        : db.bookings
            .where(user.role === 'parent' ? 'parentId' : 'specialistId')
            .equals(user.id)
            .toArray(),
    [user.id, user.role],
  );

  useEffect(() => {
    if (!bookings) return;
    for (const b of bookings) {
      if (b.status !== 'confirmed' || b.format !== 'online') continue;
      const { opensAt } = roomWindow(b);
      if (now >= opensAt && now < b.start + 5 * MINUTE) {
        notifyOnce(`room_${b.id}_${user.id}`, user.id, {
          type: 'room_open',
          title: msg('Видеокомната открыта'),
          body: msg('Занятие начнётся в {time} — можно заходить и проверить камеру.', { time: fmtTime(b.start) }),
          link: `/room/${b.id}`,
        });
      }
    }
  }, [bookings, now, user.id]);

  return null;
}

// Переходы по клику на системное уведомление (из service worker или Notification API).
export function NavigateBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    const onWindow = (e) => navigate(e.detail);
    const onWorker = (e) => {
      if (e.data?.type === 'pingo:navigate') navigate(e.data.url);
    };
    window.addEventListener('pingo:navigate', onWindow);
    navigator.serviceWorker?.addEventListener('message', onWorker);
    return () => {
      window.removeEventListener('pingo:navigate', onWindow);
      navigator.serviceWorker?.removeEventListener('message', onWorker);
    };
  }, [navigate]);
  return null;
}

// Регистрация service worker и предложение обновиться, когда вышла новая версия.
export function PwaUpdater() {
  const toast = useToast();
  const { user } = useAuth();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady || !user) return;
    toast.success(t('Pingo сохранён на устройстве и откроется даже без интернета.'));
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, toast, user]);

  useEffect(() => {
    if (!needRefresh) return;
    toast.show(t('Доступна новая версия Pingo.'), {
      title: t('Обновление'),
      duration: Infinity,
      action: { label: t('Обновить'), onClick: () => updateServiceWorker(true) },
    });
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
}
