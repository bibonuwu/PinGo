import { db } from '../lib/db';
import { uid } from '../lib/utils';

// «Raw»-функции не открывают свою транзакцию — их вызывают внутри транзакций других сервисов.
export async function notifyRaw(userId, { type, title, body = '', link = null, id = uid(), createdAt = Date.now() }) {
  const n = { id, userId, type, title, body, link, read: false, createdAt };
  await db.notifications.put(n);
  return n;
}

// Требует db.users в транзакции вызывающего.
export async function notifyAdminsRaw(payload) {
  const admins = await db.users.where('role').equals('admin').toArray();
  for (const a of admins) await notifyRaw(a.id, payload);
}

// Однократное уведомление с детерминированным id (например, «комната открыта»).
export async function notifyOnce(id, userId, payload) {
  const exists = await db.notifications.get(id);
  if (exists) return null;
  return notifyRaw(userId, { ...payload, id });
}

export function markNotificationRead(id) {
  return db.notifications.update(id, { read: true });
}

export async function markAllNotificationsRead(userId) {
  const unread = (await db.notifications.where('userId').equals(userId).toArray()).filter((n) => !n.read);
  if (unread.length) await db.notifications.bulkPut(unread.map((n) => ({ ...n, read: true })));
}

export async function clearNotifications(userId) {
  await db.notifications.where('userId').equals(userId).delete();
}
