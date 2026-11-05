import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, firestore } from '../lib/firebase';
import { db, mirrorClear, mirrorDropSource, mirrorPut, mirrorRemove, subscribe } from '../lib/db';
import { claimAdmin, isAdminAccount } from './auth';

// Синхронизация Firestore → локальное зеркало (src/lib/db.js).
// После входа слушаем свой документ users/{uid}; когда известна роль — коллекции, которые ей нужны.
// status: loading → signedOut | needsProfile (вошли, но регистрация не завершена) | ready.
// verified — подтверждена ли почта (account — объект Firebase, после reload он меняется на месте).

let state = { status: 'loading', uid: null, account: null, verified: false };
const stateWatchers = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of stateWatchers) fn(state);
}

export const getSyncState = () => state;

export function onSyncState(fn) {
  stateWatchers.add(fn);
  return () => stateWatchers.delete(fn);
}

const subs = new Map(); // ключ источника → { stop, ready }
let stopMe = null;
let stopPeopleWatch = null;
let role = null;
let session = 0;
let roleRun = 0;
let claimTried = false;
let lastMe; // users/{uid}: данные, null — аккаунта в Pingo нет, undefined — ещё неизвестно

const col = (name, ...constraints) => query(collection(firestore, name), ...constraints);
const eq = (field, value) => where(field, '==', value);
const startOfToday = () => new Date().setHours(0, 0, 0, 0);

const asIs = (snap) => ({ ...snap.data(), id: snap.id });
// Родители видят не всю анкету, а только опубликованную версию из каталога.
const catalogRow = (snap) => {
  const d = snap.data();
  return { id: snap.id, status: 'approved', published: d.published, sessionMinutes: d.sessionMinutes, verifiedAt: d.verifiedAt ?? null };
};

// Слушатель документа или запроса. ready — первый снимок данных (или ошибка).
function listen(key, target, table, { rank = 0, row = asIs } = {}) {
  if (subs.has(key)) return subs.get(key).ready;
  let done;
  const ready = new Promise((resolve) => (done = resolve));
  const onError = (error) => {
    console.error(`[sync] ${key}:`, error);
    mirrorDropSource(key);
    done();
  };
  const stop =
    target.type === 'document'
      ? onSnapshot(
          target,
          (snap) => {
            if (snap.exists()) mirrorPut(table, snap.id, key, row(snap), rank);
            else mirrorRemove(table, snap.id, key);
            done();
          },
          onError,
        )
      : onSnapshot(
          target,
          (snap) => {
            for (const change of snap.docChanges()) {
              if (change.type === 'removed') mirrorRemove(table, change.doc.id, key);
              else mirrorPut(table, change.doc.id, key, row(change.doc), rank);
            }
            done();
          },
          onError,
        );
  subs.set(key, { stop, ready });
  return ready;
}

// Имена и аватары собеседников — публичные карточки people/{id} всех, кто встречается
// в записях, диалогах и каталоге. Они ложатся в ту же таблицу users.
function watchPeople(uid) {
  const ids = new Set();
  for (const b of db.bookings.values()) ids.add(b.parentId).add(b.specialistId);
  for (const c of db.conversations.values()) ids.add(c.parentId).add(c.specialistId);
  for (const p of db.profiles.values()) ids.add(p.id);
  ids.delete(uid);
  const waits = [];
  for (const id of ids) {
    if (id && !subs.has(`people:${id}`)) waits.push(listen(`people:${id}`, doc(firestore, 'people', id), 'users'));
  }
  return Promise.all(waits);
}

async function startRole(nextRole, uid, run, admin) {
  const waits = [listen('notifications', col('notifications', eq('userId', uid)), 'notifications')];
  if (nextRole === 'admin') {
    // Роль admin без почты модератора прав не даёт — такому аккаунту ничего не загружаем.
    // Записи целиком модератору не нужны: статистику занятий считают агрегатные запросы (useAdminStats).
    if (admin) {
      waits.push(
        listen('users', col('users'), 'users', { rank: 1 }),
        listen('profiles', col('profiles'), 'profiles', { rank: 1 }),
        listen('complaints', col('complaints'), 'complaints'),
        listen('reviews', col('reviews'), 'reviews'),
        listen('certificates', col('certificates'), 'certificates'),
        listen('broadcasts', col('broadcasts'), 'broadcasts'),
      );
    }
  } else {
    const field = nextRole === 'parent' ? 'parentId' : 'specialistId';
    waits.push(
      listen('bookings', col('bookings', eq(field, uid)), 'bookings'),
      listen('conversations', col('conversations', eq(field, uid)), 'conversations'),
      listen('messages', col('messages', eq(field, uid)), 'messages'),
    );
    if (nextRole === 'parent') {
      waits.push(
        listen('children', col('children', eq('parentId', uid)), 'children'),
        listen('catalog', col('catalog'), 'profiles', { row: catalogRow }),
        listen('availability', col('availability'), 'availability'),
        // Прошедшие занятые окна не нужны, а их число растёт с каждой записью — каждое стоило бы чтения.
        // Граница — начало суток: запрос не меняется весь день, и после переподключения Firestore
        // докачивает только изменения, а не всю коллекцию заново.
        listen('busy', col('busy', where('end', '>', startOfToday())), 'busy'),
        listen('reviews', col('reviews'), 'reviews'),
        // Сертификаты выдаёт только модератор — коллекция маленькая.
        listen('certificates', col('certificates'), 'certificates'),
      );
    } else {
      waits.push(
        listen('profile', doc(firestore, 'profiles', uid), 'profiles', { rank: 1 }),
        // Дети, с которыми у специалиста есть записи (родитель добавляет его в specialistIds при записи).
        listen('children', col('children', where('specialistIds', 'array-contains', uid)), 'children'),
        listen('availability', col('availability', eq('specialistId', uid)), 'availability'),
        listen('reviews', col('reviews', eq('specialistId', uid)), 'reviews'),
        listen('certificates', col('certificates', eq('userId', uid)), 'certificates'),
      );
    }
  }
  await Promise.all(waits);
  if (run !== roleRun || nextRole === 'admin') return;
  stopPeopleWatch = subscribe(() => watchPeople(uid));
  await watchPeople(uid);
}

function stopRole() {
  roleRun += 1;
  role = null;
  stopPeopleWatch?.();
  stopPeopleWatch = null;
  for (const [key, s] of subs) {
    s.stop();
    mirrorDropSource(key);
  }
  subs.clear();
}

function stopAll() {
  session += 1;
  claimTried = false;
  lastMe = undefined;
  stopMe?.();
  stopMe = null;
  stopRole();
  mirrorClear();
}

export function startSync() {
  onAuthStateChanged(auth, (account) => {
    stopAll();
    if (!account) {
      setState({ status: 'signedOut', uid: null, account: null });
      return;
    }
    const uid = account.uid;
    const current = session;
    setState({ status: 'loading', uid, account, verified: account.emailVerified });

    // Почта модератора без роли admin: выдаём роль (один раз за сессию) и ждём следующий снимок —
    // локальная запись приходит сразу. Если запись не прошла, разбираем снимок заново с прежней ролью.
    const claim = (data, snap) => {
      if (claimTried || !isAdminAccount(account)) return false;
      claimTried = true;
      claimAdmin(account, data).catch((e) => {
        console.error('[sync] admin:', e);
        if (current === session) onMe(snap);
      });
      return true;
    };

    async function onMe(snap) {
      if (current !== session) return;
      if (!snap.exists()) {
        // Без сети документа может не быть только в кэше — ждём ответа сервера.
        if (snap.metadata.fromCache) return;
        lastMe = null;
        if (claim(null, snap)) return;
        stopRole();
        mirrorRemove('users', uid, 'me');
        setState({ status: 'needsProfile' });
        return;
      }
      const data = snap.data();
      lastMe = data;
      if (data.role !== 'admin' && claim(data, snap)) return;
      mirrorPut('users', uid, 'me', { ...data, id: uid }, 2);
      if (data.role === role) return;
      stopRole();
      role = data.role;
      const run = roleRun;
      setState({ status: 'loading' });
      await startRole(role, uid, run, isAdminAccount(account));
      if (run === roleRun && current === session) setState({ status: 'ready' });
    }

    stopMe = onSnapshot(
      doc(firestore, 'users', uid),
      onMe,
      (error) => {
        console.error('[sync] users/me:', error);
        signOut(auth);
      },
    );
  });
}

// После подтверждения почты: обновляем токен (правила Firestore видят email_verified) и, если это почта
// модератора, выдаём роль admin. Возвращает, подтверждена ли почта.
export async function recheckAccount() {
  const account = auth.currentUser;
  if (!account) return false;
  await account.reload();
  await account.getIdToken(true);
  setState({ verified: account.emailVerified });
  if (!isAdminAccount(account) || lastMe === undefined) return account.emailVerified;
  if (lastMe?.role !== 'admin') {
    claimTried = true;
    await claimAdmin(account, lastMe);
  } else {
    // Роль уже admin, но коллекции модератора не загружались, пока почта не была подтверждена.
    stopRole();
    role = 'admin';
    const run = roleRun;
    setState({ status: 'loading' });
    await startRole('admin', account.uid, run, true);
    if (run === roleRun) setState({ status: 'ready' });
  }
  return true;
}
