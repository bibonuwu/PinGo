import { arrayUnion } from 'firebase/firestore';
import { db } from '../lib/db';
import { batch, commit, ref } from '../lib/remote';
import { ROOM_CLOSES_AFTER_MIN, ROOM_OPENS_BEFORE_MIN } from '../lib/constants';
import { generateSlots, isActiveBooking } from '../lib/slots';
import { MINUTE, ageFromBirthDate, firstName, uid } from '../lib/utils';
import { ensureConversationRaw, pushMessageRaw } from './chat';
import { notifyRaw } from './notifications';
import { msg } from '../i18n/stored';
import { t } from '../i18n';

// Хранимые статусы: pending → confirmed | declined | cancelled.
// Производные (для показа): completed — подтверждённое занятие закончилось;
// expired — запрос так и не подтвердили до начала.
export function displayStatus(b, now = Date.now()) {
  if (b.status === 'confirmed' && now >= b.end) return 'completed';
  if (b.status === 'pending' && now >= b.start) return 'expired';
  return b.status;
}

export const isUpcoming = (b, now = Date.now()) => isActiveBooking(b) && b.end > now && displayStatus(b, now) !== 'expired';

// Занятое окно специалиста: busy/{specialistId}_{start}.
export const busyId = (specialistId, start) => `${specialistId}_${start}`;

const SLOT_TAKEN = t('Это время уже заняли. Выберите другое окно.');

export function roomWindow(b) {
  return {
    opensAt: b.start - ROOM_OPENS_BEFORE_MIN * MINUTE,
    closesAt: b.end + ROOM_CLOSES_AFTER_MIN * MINUTE,
  };
}

// Видеокомната открывается за 15 минут до начала и только для подтверждённой онлайн-записи.
export function roomState(b, now = Date.now()) {
  if (!b) return 'unavailable';
  if (b.format !== 'online') return 'offline';
  if (b.status === 'pending') return 'unconfirmed';
  if (b.status !== 'confirmed') return 'unavailable';
  const { opensAt, closesAt } = roomWindow(b);
  if (now < opensAt) return 'waiting';
  if (now > closesAt) return 'ended';
  return 'open';
}

async function loadParties(b) {
  const [parent, specialist, child] = await Promise.all([
    db.users.get(b.parentId),
    db.users.get(b.specialistId),
    db.children.get(b.childId),
  ]);
  return { parent, specialist, child };
}

export async function createBooking({ parentId, childId, specialistId, start, format, note }) {
  const [profile, child, parent, specialist] = await Promise.all([
    db.profiles.get(specialistId),
    db.children.get(childId),
    db.users.get(parentId),
    db.users.get(specialistId),
  ]);
  if (!profile?.published) throw new Error(t('Специалист сейчас не принимает записи'));
  if (!child || child.parentId !== parentId) throw new Error(t('Выберите ребёнка'));
  if (!profile.published.formats.includes(format)) throw new Error(t('Выберите формат занятия'));
  const duration = profile.sessionMinutes;
  const end = start + duration * MINUTE;
  const cleanNote = (note || '').trim().slice(0, 500);

  const now = Date.now();
  const rules = await db.availability.where('specialistId').equals(specialistId).toArray();
  const busy = await db.busy.where('specialistId').equals(specialistId).toArray();
  const free = generateSlots({ rules, busy, duration, from: now });
  if (!free.some((s) => s.start === start)) throw new Error(SLOT_TAKEN);
  const childBusy = (await db.bookings.where('childId').equals(childId).toArray()).some(
    (b) => isActiveBooking(b) && b.start < end && b.end > start,
  );
  if (childBusy) throw new Error(t('{name}: в это время уже есть другое занятие', { name: child.name }));

  const booking = {
    id: uid(),
    parentId,
    childId,
    specialistId,
    start,
    end,
    duration,
    format,
    note: cleanNote,
    status: 'pending',
    statusReason: null,
    cancelledBy: null,
    report: null,
    reviewId: null,
    createdAt: now,
    updatedAt: now,
  };
  const w = batch();
  w.set(ref('bookings', booking.id), booking);
  // Занятое окно видят все родители. Правила не дают создать второй документ на то же время,
  // поэтому два родителя не запишутся в одно окно, даже если нажмут одновременно.
  w.set(ref('busy', busyId(specialistId, start)), { id: busyId(specialistId, start), specialistId, bookingId: booking.id, start, end });
  // Специалист записи видит профиль ребёнка (потребности, цели, доступность).
  if (!child.specialistIds?.includes(specialistId)) {
    w.update(ref('children', childId), { specialistIds: arrayUnion(specialistId) });
  }
  const conv = ensureConversationRaw(w, parentId, specialistId);
  pushMessageRaw(w, conv, {
    senderId: 'system',
    kind: 'system',
    bookingId: booking.id,
    text: msg('Запрос на занятие: {time} · {name}', { time: { ts: start }, name: child.name }),
    unreadFor: [specialistId],
    createdAt: now,
  });
  if (cleanNote) pushMessageRaw(w, conv, { senderId: parentId, text: cleanNote, unreadFor: [specialistId], createdAt: now + 1 });
  notifyRaw(w, specialistId, {
    type: 'booking_request',
    title: msg('Новый запрос на занятие'),
    body: msg('{parent} · {child}, {age} · {time}', {
      parent: parent.name,
      child: child.name,
      age: { age: ageFromBirthDate(child.birthDate) },
      time: { ts: start },
    }),
    link: `/specialist/requests/${booking.id}`,
  });
  try {
    await commit(w);
  } catch (e) {
    if (e.code === 'permission-denied') throw new Error(SLOT_TAKEN);
    throw e;
  }
  return { booking, specialistName: specialist?.name };
}

// Изменение записи + системное сообщение в чат + уведомление — одним пакетом.
async function transition(bookingId, mutate) {
  const b = await db.bookings.get(bookingId);
  if (!b) throw new Error(t('Запись не найдена'));
  const parties = await loadParties(b);
  const w = batch();
  const conv = ensureConversationRaw(w, b.parentId, b.specialistId);
  const result = await mutate(b, { ...parties, w, conv, now: Date.now() });
  await commit(w);
  return result;
}

// Окно снова свободно для других родителей.
const releaseSlot = (w, b) => w.delete(ref('busy', busyId(b.specialistId, b.start)));

export function confirmBooking(specialistId, bookingId) {
  return transition(bookingId, async (b, { child, specialist, w, conv, now }) => {
    if (b.specialistId !== specialistId) throw new Error(t('Нет доступа к записи'));
    if (b.status !== 'pending') throw new Error(t('Запрос уже обработан'));
    if (b.start <= now) throw new Error(t('Время занятия уже прошло'));
    const clash = (await db.bookings.where('specialistId').equals(specialistId).toArray()).find(
      (x) => x.id !== b.id && x.status === 'confirmed' && x.start < b.end && x.end > b.start,
    );
    if (clash) throw new Error(t('На это время у вас уже есть подтверждённое занятие'));
    w.update(ref('bookings', b.id), { status: 'confirmed', confirmedAt: now, updatedAt: now });
    pushMessageRaw(w, conv, {
      senderId: 'system',
      kind: 'system',
      bookingId: b.id,
      text: msg('Занятие подтверждено: {time}', { time: { ts: b.start } }),
      unreadFor: [b.parentId],
    });
    notifyRaw(w, b.parentId, {
      type: 'booking_confirmed',
      title: msg('Занятие подтверждено'),
      body: msg('{name} подтвердил(а) занятие · {child} · {time}', {
        name: specialist.name,
        child: child?.name ?? { t: 'ребёнок' },
        time: { ts: b.start },
      }),
      link: `/parent/bookings/${b.id}`,
    });
  });
}

export function declineBooking(specialistId, bookingId, reason = '') {
  return transition(bookingId, async (b, { specialist, w, conv, now }) => {
    if (b.specialistId !== specialistId) throw new Error(t('Нет доступа к записи'));
    if (b.status !== 'pending') throw new Error(t('Запрос уже обработан'));
    const r = reason.trim();
    w.update(ref('bookings', b.id), { status: 'declined', statusReason: r || null, updatedAt: now });
    releaseSlot(w, b);
    pushMessageRaw(w, conv, {
      senderId: 'system',
      kind: 'system',
      bookingId: b.id,
      text: r ? msg('Запрос отклонён: {reason}', { reason: r }) : msg('Запрос отклонён'),
      unreadFor: [b.parentId],
    });
    notifyRaw(w, b.parentId, {
      type: 'booking_declined',
      title: msg('Запрос отклонён'),
      body: r
        ? msg('{name}: {reason}', { name: specialist.name, reason: r })
        : msg('{name}: не сможет провести занятие в это время', { name: specialist.name }),
      link: `/parent/bookings/${b.id}`,
    });
  });
}

// Родитель может отменить запрос или подтверждённую запись, специалист — подтверждённую.
export function cancelBooking(userId, bookingId, reason = '') {
  return transition(bookingId, async (b, { parent, specialist, child, w, conv, now }) => {
    const byParent = userId === b.parentId;
    const bySpecialist = userId === b.specialistId;
    if (!byParent && !bySpecialist) throw new Error(t('Нет доступа к записи'));
    if (!isActiveBooking(b)) throw new Error(t('Запись уже неактивна'));
    if (bySpecialist && b.status === 'pending') throw new Error(t('Запрос можно отклонить, а не отменить'));
    if (b.start <= now) throw new Error(t('Занятие уже началось — отменить его нельзя'));
    const r = reason.trim();
    w.update(ref('bookings', b.id), { status: 'cancelled', statusReason: r || null, cancelledBy: userId, updatedAt: now });
    releaseSlot(w, b);
    const whoName = byParent ? parent?.name : specialist?.name;
    const who = whoName ?? { t: 'Участник' };
    const other = byParent ? b.specialistId : b.parentId;
    pushMessageRaw(w, conv, {
      senderId: 'system',
      kind: 'system',
      bookingId: b.id,
      text: msg(r ? '{name} отменил(а) занятие {time}: {reason}' : '{name} отменил(а) занятие {time}', {
        name: whoName ? firstName(whoName) : who,
        time: { ts: b.start },
        reason: r,
      }),
      unreadFor: [other],
    });
    notifyRaw(w, other, {
      type: 'booking_cancelled',
      title: msg('Занятие отменено'),
      body: msg(r ? '{name} · {child} · {time} — {reason}' : '{name} · {child} · {time}', {
        name: who,
        child: child?.name ?? '',
        time: { ts: b.start },
        reason: r,
      }),
      link: byParent ? `/specialist/requests/${b.id}` : `/parent/bookings/${b.id}`,
    });
  });
}

// Отчёт специалиста после занятия (из концепции: «отчёты после каждого занятия»).
export function addSessionReport(specialistId, bookingId, { summary, progress, homework }) {
  return transition(bookingId, async (b, { specialist, child, w, now }) => {
    if (b.specialistId !== specialistId) throw new Error(t('Нет доступа к записи'));
    if (displayStatus(b, now) !== 'completed') throw new Error(t('Отчёт можно добавить после занятия'));
    if (b.report) throw new Error(t('Отчёт уже добавлен'));
    if ((summary || '').trim().length < 10) throw new Error(t('Опишите занятие — минимум 10 символов'));
    const report = {
      summary: summary.trim(),
      progress: (progress || '').trim(),
      homework: (homework || '').trim(),
      createdAt: now,
    };
    w.update(ref('bookings', b.id), { report, updatedAt: now });
    notifyRaw(w, b.parentId, {
      type: 'report_added',
      title: msg('Отчёт о занятии'),
      body: msg('{name} добавил(а) отчёт · {child}', { name: specialist.name, child: child?.name ?? { t: 'занятие' } }),
      link: `/parent/bookings/${b.id}`,
    });
  });
}

export async function addReview(parentId, bookingId, { rating, text }) {
  const b = await db.bookings.get(bookingId);
  if (!b || b.parentId !== parentId) throw new Error(t('Запись не найдена'));
  if (displayStatus(b) !== 'completed') throw new Error(t('Отзыв можно оставить после занятия'));
  if (b.reviewId) throw new Error(t('Вы уже оставили отзыв'));
  if (!(rating >= 1 && rating <= 5)) throw new Error(t('Поставьте оценку от 1 до 5'));
  const { parent, child } = await loadParties(b);
  const now = Date.now();
  const review = {
    id: uid(),
    specialistId: b.specialistId,
    parentId,
    bookingId,
    // Подпись видят все родители — хранится по-русски и переводится при показе (reviewAuthor).
    authorName: `${firstName(parent.name)}, родитель`,
    childAge: child ? ageFromBirthDate(child.birthDate) : null,
    rating,
    text: (text || '').trim().slice(0, 1000),
    createdAt: now,
  };
  const w = batch();
  w.set(ref('reviews', review.id), review);
  w.update(ref('bookings', bookingId), { reviewId: review.id, updatedAt: now });
  notifyRaw(w, b.specialistId, {
    type: 'review_added',
    title: msg('Новый отзыв: {stars}', { stars: '★'.repeat(rating) }),
    body: review.text || msg('Родитель {name} оценил(а) занятие', { name: firstName(parent.name) }),
    link: `/specialist/requests/${bookingId}`,
  });
  await commit(w);
  return review;
}
