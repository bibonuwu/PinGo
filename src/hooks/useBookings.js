import { useEffect, useState } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { useLiveQuery } from './useLiveQuery';
import { db } from '../lib/db';
import { firestore } from '../lib/firebase';

async function joinBookings(list) {
  const userIds = [...new Set(list.flatMap((b) => [b.parentId, b.specialistId]))];
  const childIds = [...new Set(list.map((b) => b.childId))];
  const [users, children] = await Promise.all([db.users.bulkGet(userIds), db.children.bulkGet(childIds)]);
  const u = Object.fromEntries(users.filter(Boolean).map((x) => [x.id, x]));
  const c = Object.fromEntries(children.filter(Boolean).map((x) => [x.id, x]));
  return list.map((b) => ({ ...b, parent: u[b.parentId], specialist: u[b.specialistId], child: c[b.childId] }));
}

// Записи пользователя с подтянутыми родителем, специалистом и ребёнком.
export function useBookingsFor(user) {
  return useLiveQuery(async () => {
    if (!user || user.role === 'admin') return [];
    const field = user.role === 'parent' ? 'parentId' : 'specialistId';
    const list = await db.bookings.where(field).equals(user.id).toArray();
    return joinBookings(list);
  }, [user?.id, user?.role]);
}

export function useBooking(id) {
  return useLiveQuery(async () => {
    const b = await db.bookings.get(id);
    if (!b) return null;
    const [joined] = await joinBookings([b]);
    const review = b.reviewId ? await db.reviews.get(b.reviewId) : null;
    return { ...joined, review };
  }, [id]);
}

export function useChildren(parentId) {
  return useLiveQuery(
    async () =>
      parentId ? (await db.children.where('parentId').equals(parentId).toArray()).sort((a, b) => a.createdAt - b.createdAt) : [],
    [parentId],
  );
}

// Сколько всего записей у специалиста — для модератора (сами записи модератору не загружаются).
export function useBookingsCount(specialistId) {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let active = true;
    getCountFromServer(query(collection(firestore, 'bookings'), where('specialistId', '==', specialistId)))
      .then((snap) => active && setCount(snap.data().count))
      .catch(() => active && setCount('—'));
    return () => {
      active = false;
    };
  }, [specialistId]);
  return count ?? '…';
}
