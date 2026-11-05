import { deleteUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { db } from '../lib/db';
import { batch, commit, commitEach, friendlyError, ref } from '../lib/remote';
import { downloadFile, toDateKey } from '../lib/utils';
import { isActiveBooking } from '../lib/slots';
import { deleteFile } from './files';
import { t } from '../i18n';

const RECENT_LOGIN_MS = 5 * 60 * 1000;

// Экспорт данных, которые видит пользователь (свои записи, дети, сообщения…), в JSON.
export async function exportData() {
  const out = { app: 'pingo', exportedAt: new Date().toISOString(), tables: {} };
  for (const table of db.tables) {
    const rows = await table.toArray();
    if (rows.length) out.tables[table.name] = rows;
  }
  downloadFile(`pingo-data-${toDateKey(Date.now())}.json`, JSON.stringify(out, null, 2));
}

// Удаление аккаунта: профиль, дети, анкета, расписание, уведомления, документы и сам вход.
// Записи и переписка остаются у второй стороны (специалиста или родителя).
// onStart вызывается, когда проверки пройдены и начинается удаление.
export async function deleteAccount(user, onStart) {
  const account = auth.currentUser;
  if (!account || account.uid !== user.id) throw new Error(t('Сначала войдите в аккаунт'));
  // Firebase удаляет вход только после недавней авторизации — проверяем заранее, до удаления данных.
  const lastLogin = Date.parse(account.metadata.lastSignInTime || '') || 0;
  if (Date.now() - lastLogin > RECENT_LOGIN_MS) {
    throw new Error(t('Для удаления аккаунта выйдите и войдите снова, затем повторите удаление.'));
  }
  const now = Date.now();
  if ((await db.bookings.toArray()).some((b) => isActiveBooking(b) && b.end > now)) {
    throw new Error(t('Сначала отмените активные записи'));
  }
  onStart?.();

  if (user.role === 'parent') {
    const children = await db.children.where('parentId').equals(user.id).toArray();
    await commitEach(children, (w, c) => w.delete(ref('children', c.id)));
  }
  if (user.role === 'specialist') {
    const profile = db.profiles.peek(user.id);
    for (const d of profile?.draft?.documents ?? []) await deleteFile(d);
    for (const d of profile?.published?.documents ?? []) await deleteFile(d);
    const rules = await db.availability.where('specialistId').equals(user.id).toArray();
    await commitEach(rules, (w, r) => w.delete(ref('availability', r.id)));
    const w = batch();
    if (profile?.published) w.delete(ref('catalog', user.id));
    w.delete(ref('profiles', user.id));
    await commit(w);
  }
  const notifications = await db.notifications.where('userId').equals(user.id).toArray();
  await commitEach(notifications, (w, n) => w.delete(ref('notifications', n.id)));

  const w = batch();
  w.delete(ref('people', user.id));
  w.delete(ref('users', user.id));
  await commit(w);
  await deleteUser(account).catch((e) => {
    throw friendlyError(e);
  });
}
