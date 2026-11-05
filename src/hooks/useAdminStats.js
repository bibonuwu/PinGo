import { useEffect, useState } from 'react';
import { collection, count, getAggregateFromServer, getCountFromServer, query, sum, where } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { DAY, startOfDay } from '../lib/utils';

// Статистика занятий для модератора. Записи целиком модератору не загружаются: считают агрегатные
// запросы Firestore (одно чтение на каждую 1000 записей). Индексы — в firestore.indexes.json.
// Ответы держим 5 минут, чтобы переходы между страницами не повторяли запросы.
const TTL = 5 * 60 * 1000;
const cache = new Map();

function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

// Ошибка (например, индекс ещё строится) не ломает страницу: вместо числа будет «—».
const safe = (promise) =>
  promise.catch((e) => {
    console.warn('[stats]', e);
    return null;
  });

const bookings = () => collection(firestore, 'bookings');

// Проведённые занятия — подтверждённые записи, которые уже закончились (начиная с since, если задан).
function sessions(filters, since) {
  const q = query(
    bookings(),
    ...filters,
    where('status', '==', 'confirmed'),
    where('end', '<', Date.now()),
    ...(since ? [where('end', '>=', since)] : []),
  );
  return getAggregateFromServer(q, { sessions: count(), minutes: sum('duration') }).then((s) => s.data());
}

// Начало периода «последние 30 дней» — граница суток, чтобы ключ кэша не менялся весь день.
export const monthAgo = () => startOfDay(Date.now()).getTime() - 30 * DAY;

// { [specialistId]: { sessions, minutes } | null } или null, пока считается.
export function useSessionStats(ids, since = null) {
  const key = ids.join(',');
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let active = true;
    const list = key ? key.split(',') : [];
    Promise.all(
      list.map((id) => safe(cached(`sp:${id}:${since ?? 'all'}`, () => sessions([where('specialistId', '==', id)], since)))),
    ).then((rows) => {
      if (active) setStats(Object.fromEntries(list.map((id, i) => [id, rows[i]])));
    });
    return () => {
      active = false;
    };
  }, [key, since]);
  return stats;
}

// Итоги по платформе: всего записей, проведено занятий за всё время и за 30 дней.
export function useBookingTotals() {
  const [totals, setTotals] = useState(null);
  useEffect(() => {
    let active = true;
    const since = monthAgo();
    Promise.all([
      safe(cached('total', () => getCountFromServer(bookings()).then((s) => s.data().count))),
      safe(cached('done:all', () => sessions([], null))),
      safe(cached(`done:${since}`, () => sessions([], since))),
    ]).then(([total, done, month]) => {
      if (active) setTotals({ total, done, month });
    });
    return () => {
      active = false;
    };
  }, []);
  return totals;
}
