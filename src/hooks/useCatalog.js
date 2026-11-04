import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { generateSlots, isActiveBooking } from '../lib/slots';
import { BOOKING_LEAD_MIN } from '../lib/constants';
import { MINUTE } from '../lib/utils';

function buildEntry(profile, user, rules, bookings, reviews, now) {
  const busy = bookings.filter(isActiveBooking);
  const rating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  return {
    id: profile.id,
    user,
    profile,
    data: profile.published,
    sessionMinutes: profile.sessionMinutes,
    rules,
    slots: generateSlots({ rules, busy, duration: profile.sessionMinutes, from: now }),
    rating,
    reviewsCount: reviews.length,
  };
}

// Каталог опубликованных анкет: данные, свободные окна на 3 недели, рейтинг.
export function useCatalog() {
  return useLiveQuery(async () => {
    const profiles = (await db.profiles.toArray()).filter((p) => p.published);
    const ids = profiles.map((p) => p.id);
    const [users, rules, bookings, reviews] = await Promise.all([
      db.users.bulkGet(ids),
      db.availability.where('specialistId').anyOf(ids).toArray(),
      db.bookings.where('specialistId').anyOf(ids).toArray(),
      db.reviews.where('specialistId').anyOf(ids).toArray(),
    ]);
    const now = Date.now();
    return profiles
      .map((p, i) =>
        buildEntry(
          p,
          users[i],
          rules.filter((r) => r.specialistId === p.id),
          bookings.filter((b) => b.specialistId === p.id),
          reviews.filter((r) => r.specialistId === p.id),
          now,
        ),
      )
      .filter((e) => e.user);
  }, []);
}

// Одна анкета по id (в том числе неопубликованная — для владельца и модератора).
export function useSpecialist(id) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const profile = await db.profiles.get(id);
    if (!profile) return null;
    const [user, rules, bookings, reviews] = await Promise.all([
      db.users.get(id),
      db.availability.where('specialistId').equals(id).toArray(),
      db.bookings.where('specialistId').equals(id).toArray(),
      db.reviews.where('specialistId').equals(id).toArray(),
    ]);
    if (!user) return null;
    const entry = profile.published
      ? buildEntry(profile, user, rules, bookings, reviews, Date.now())
      : { id, user, profile, data: null, rules, slots: [], rating: null, reviewsCount: 0 };
    return { ...entry, reviews: reviews.sort((a, b) => b.createdAt - a.createdAt) };
  }, [id]);
}

// Окна, которые ещё можно забронировать с учётом текущего времени.
export const freshSlots = (slots, now) => slots.filter((s) => s.start >= now + BOOKING_LEAD_MIN * MINUTE);
