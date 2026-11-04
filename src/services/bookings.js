import { db } from '../lib/db';
import { ROOM_CLOSES_AFTER_MIN, ROOM_OPENS_BEFORE_MIN } from '../lib/constants';
import { generateSlots, isActiveBooking } from '../lib/slots';
import { MINUTE, ageFromBirthDate, firstName, fmtAge, fmtStamp, uid } from '../lib/utils';
import { ensureConversationRaw, pushMessageRaw, conversationIdFor } from './chat';
import { notifyRaw } from './notifications';

// Хранимые статусы: pending → confirmed | declined | cancelled.
// Производные (для показа): completed — подтверждённое занятие закончилось;
// expired — запрос так и не подтвердили до начала.
export function displayStatus(b, now = Date.now()) {
  if (b.status === 'confirmed' && now >= b.end) return 'completed';
  if (b.status === 'pending' && now >= b.start) return 'expired';
  return b.status;
}

export const isUpcoming = (b, now = Date.now()) => isActiveBooking(b) && b.end > now && displayStatus(b, now) !== 'expired';

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
  if (!profile?.published) throw new Error('Специалист сейчас не принимает записи');
  if (!child || child.parentId !== parentId) throw new Error('Выберите ребёнка');
  if (!profile.published.formats.includes(format)) throw new Error('Выберите формат занятия');
  const duration = profile.sessionMinutes;
  const end = start + duration * MINUTE;
  const cleanNote = (note || '').trim().slice(0, 500);

  return db.transaction(
    'rw',
    [db.bookings, db.availability, db.conversations, db.messages, db.notifications],
    async () => {
      const now = Date.now();
      const rules = await db.availability.where('specialistId').equals(specialistId).toArray();
      const busy = (await db.bookings.where('specialistId').equals(specialistId).toArray()).filter(isActiveBooking);
      const free = generateSlots({ rules, busy, duration, from: now });
      if (!free.some((s) => s.start === start)) throw new Error('Это время уже заняли. Выберите другое окно.');
      const childBusy = (await db.bookings.where('childId').equals(childId).toArray()).some(
        (b) => isActiveBooking(b) && b.start < end && b.end > start,
      );
      if (childBusy) throw new Error(`У ${child.name} уже есть занятие в это время`);

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
      await db.bookings.add(booking);
      const convId = await ensureConversationRaw(parentId, specialistId);
      await pushMessageRaw(convId, {
        senderId: 'system',
        kind: 'system',
        bookingId: booking.id,
        text: `Запрос на занятие: ${fmtStamp(start)} · ${child.name}`,
        unreadFor: [specialistId],
      });
      if (cleanNote) await pushMessageRaw(convId, { senderId: parentId, text: cleanNote, unreadFor: [specialistId] });
      await notifyRaw(specialistId, {
        type: 'booking_request',
        title: 'Новый запрос на занятие',
        body: `${parent.name} · ${child.name}, ${fmtAge(ageFromBirthDate(child.birthDate))} · ${fmtStamp(start)}`,
        link: `/specialist/requests/${booking.id}`,
      });
      return { booking, specialistName: specialist?.name };
    },
  );
}

async function transition(bookingId, mutate) {
  const before = await db.bookings.get(bookingId);
  if (!before) throw new Error('Запись не найдена');
  const parties = await loadParties(before);
  return db.transaction('rw', [db.bookings, db.conversations, db.messages, db.notifications], async () => {
    const b = await db.bookings.get(bookingId);
    const convId = conversationIdFor(b.parentId, b.specialistId);
    await ensureConversationRaw(b.parentId, b.specialistId);
    return mutate(b, { ...parties, convId, now: Date.now() });
  });
}

export function confirmBooking(specialistId, bookingId) {
  return transition(bookingId, async (b, { child, specialist, convId, now }) => {
    if (b.specialistId !== specialistId) throw new Error('Нет доступа к записи');
    if (b.status !== 'pending') throw new Error('Запрос уже обработан');
    if (b.start <= now) throw new Error('Время занятия уже прошло');
    const clash = (await db.bookings.where('specialistId').equals(specialistId).toArray()).find(
      (x) => x.id !== b.id && x.status === 'confirmed' && x.start < b.end && x.end > b.start,
    );
    if (clash) throw new Error('На это время у вас уже есть подтверждённое занятие');
    await db.bookings.update(b.id, { status: 'confirmed', confirmedAt: now, updatedAt: now });
    await pushMessageRaw(convId, {
      senderId: 'system',
      kind: 'system',
      bookingId: b.id,
      text: `Занятие подтверждено: ${fmtStamp(b.start)}`,
      unreadFor: [b.parentId],
    });
    await notifyRaw(b.parentId, {
      type: 'booking_confirmed',
      title: 'Занятие подтверждено',
      body: `${specialist.name} ждёт ${child?.name ?? 'ребёнка'} · ${fmtStamp(b.start)}`,
      link: `/parent/bookings/${b.id}`,
    });
  });
}

export function declineBooking(specialistId, bookingId, reason = '') {
  return transition(bookingId, async (b, { specialist, convId, now }) => {
    if (b.specialistId !== specialistId) throw new Error('Нет доступа к записи');
    if (b.status !== 'pending') throw new Error('Запрос уже обработан');
    const r = reason.trim();
    await db.bookings.update(b.id, { status: 'declined', statusReason: r || null, updatedAt: now });
    await pushMessageRaw(convId, {
      senderId: 'system',
      kind: 'system',
      bookingId: b.id,
      text: `Запрос отклонён${r ? `: ${r}` : ''}`,
      unreadFor: [b.parentId],
    });
    await notifyRaw(b.parentId, {
      type: 'booking_declined',
      title: 'Запрос отклонён',
      body: `${specialist.name}: ${r || 'не сможет провести занятие в это время'}`,
      link: `/parent/bookings/${b.id}`,
    });
  });
}

// Родитель может отменить запрос или подтверждённую запись, специалист — подтверждённую.
export function cancelBooking(userId, bookingId, reason = '') {
  return transition(bookingId, async (b, { parent, specialist, child, convId, now }) => {
    const byParent = userId === b.parentId;
    const bySpecialist = userId === b.specialistId;
    if (!byParent && !bySpecialist) throw new Error('Нет доступа к записи');
    if (!isActiveBooking(b)) throw new Error('Запись уже неактивна');
    if (bySpecialist && b.status === 'pending') throw new Error('Запрос можно отклонить, а не отменить');
    if (b.start <= now) throw new Error('Занятие уже началось — отменить его нельзя');
    const r = reason.trim();
    await db.bookings.update(b.id, { status: 'cancelled', statusReason: r || null, cancelledBy: userId, updatedAt: now });
    const who = byParent ? parent.name : specialist.name;
    const other = byParent ? b.specialistId : b.parentId;
    await pushMessageRaw(convId, {
      senderId: 'system',
      kind: 'system',
      bookingId: b.id,
      text: `${firstName(who)} отменил(а) занятие ${fmtStamp(b.start)}${r ? `: ${r}` : ''}`,
      unreadFor: [other],
    });
    await notifyRaw(other, {
      type: 'booking_cancelled',
      title: 'Занятие отменено',
      body: `${who} · ${child?.name ?? ''} · ${fmtStamp(b.start)}${r ? ` — ${r}` : ''}`,
      link: byParent ? `/specialist/requests/${b.id}` : `/parent/bookings/${b.id}`,
    });
  });
}

// Отчёт специалиста после занятия (из концепции: «отчёты после каждого занятия»).
export function addSessionReport(specialistId, bookingId, { summary, progress, homework }) {
  return transition(bookingId, async (b, { specialist, child, now }) => {
    if (b.specialistId !== specialistId) throw new Error('Нет доступа к записи');
    if (displayStatus(b, now) !== 'completed') throw new Error('Отчёт можно добавить после занятия');
    if (b.report) throw new Error('Отчёт уже добавлен');
    if ((summary || '').trim().length < 10) throw new Error('Опишите занятие — минимум 10 символов');
    const report = {
      summary: summary.trim(),
      progress: (progress || '').trim(),
      homework: (homework || '').trim(),
      createdAt: now,
    };
    await db.bookings.update(b.id, { report, updatedAt: now });
    await notifyRaw(b.parentId, {
      type: 'report_added',
      title: 'Отчёт о занятии',
      body: `${specialist.name} рассказал(а), как прошло занятие с ${child?.name ?? 'ребёнком'}`,
      link: `/parent/bookings/${b.id}`,
    });
  });
}

export async function addReview(parentId, bookingId, { rating, text }) {
  const b = await db.bookings.get(bookingId);
  if (!b || b.parentId !== parentId) throw new Error('Запись не найдена');
  if (displayStatus(b) !== 'completed') throw new Error('Отзыв можно оставить после занятия');
  if (b.reviewId) throw new Error('Вы уже оставили отзыв');
  if (!(rating >= 1 && rating <= 5)) throw new Error('Поставьте оценку от 1 до 5');
  const { parent, child } = await loadParties(b);
  const now = Date.now();
  const review = {
    id: uid(),
    specialistId: b.specialistId,
    parentId,
    bookingId,
    authorName: `${firstName(parent.name)}, родитель`,
    childAge: child ? ageFromBirthDate(child.birthDate) : null,
    rating,
    text: (text || '').trim().slice(0, 1000),
    createdAt: now,
  };
  await db.transaction('rw', db.reviews, db.bookings, db.notifications, async () => {
    await db.reviews.add(review);
    await db.bookings.update(bookingId, { reviewId: review.id, updatedAt: now });
    await notifyRaw(b.specialistId, {
      type: 'review_added',
      title: `Новый отзыв: ${'★'.repeat(rating)}`,
      body: review.text || `${review.authorName} оценил(а) занятие`,
      link: `/specialist/requests/${bookingId}`,
    });
  });
  return review;
}
