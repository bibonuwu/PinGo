import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { db } from '../lib/db';
import { batch, commit, commitEach, ref, update } from '../lib/remote';
import { uid } from '../lib/utils';
import { isMsg, plainText } from '../i18n/stored';

// «Raw»-функции не сохраняют сами — они добавляют запись в пакет (writeBatch) вызывающего сервиса.
// title и body — строка или шаблон msg(): шаблон адресат увидит на своём языке (см. i18n/stored.js).
export function notifyRaw(w, userId, { type, title, body = '', link = null, id = uid(), createdAt = Date.now() }) {
  const n = { id, userId, type, title: plainText(title), body: plainText(body), link, read: false, createdAt };
  if (isMsg(title) || isMsg(body)) n.i18n = { title: isMsg(title) ? title : null, body: isMsg(body) ? body : null };
  w.set(ref('notifications', id), n);
  return n;
}

// Модераторы — по публичным карточкам с ролью admin. Без сети уведомления им пропускаем:
// новые анкеты и жалобы модератор всё равно увидит в своих списках.
export async function notifyAdminsRaw(w, payload) {
  try {
    const admins = await getDocs(query(collection(firestore, 'people'), where('role', '==', 'admin')));
    admins.forEach((a) => notifyRaw(w, a.id, payload));
  } catch (e) {
    console.warn('Не удалось уведомить модераторов', e);
  }
}

// Однократное уведомление с детерминированным id (например, «комната открыта»).
export async function notifyOnce(id, userId, payload) {
  if (db.notifications.peek(id)) return null;
  const w = batch();
  const n = notifyRaw(w, userId, { ...payload, id });
  await commit(w);
  return n;
}

export function markNotificationRead(id) {
  return update('notifications', id, { read: true });
}

export async function markAllNotificationsRead(userId) {
  const unread = (await db.notifications.where('userId').equals(userId).toArray()).filter((n) => !n.read);
  await commitEach(unread, (w, n) => w.update(ref('notifications', n.id), { read: true }));
}

export async function clearNotifications(userId) {
  const list = await db.notifications.where('userId').equals(userId).toArray();
  await commitEach(list, (w, n) => w.delete(ref('notifications', n.id)));
}
