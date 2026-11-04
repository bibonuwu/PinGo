import { BOOKING_HORIZON_DAYS, BOOKING_LEAD_MIN } from './constants';
import { MINUTE, addDays, atMinutes, hhmmToMinutes, startOfDay, toDateKey } from './utils';

export const ACTIVE_BOOKING = new Set(['pending', 'confirmed']);
export const isActiveBooking = (b) => ACTIVE_BOOKING.has(b.status);

/**
 * Свободные окна специалиста.
 * rules — еженедельные ({ type: 'weekly', weekday, start, end }) и разовые ({ type: 'date', date, start, end }) окна;
 * busy — активные записи специалиста ({ start, end }); duration — длительность занятия в минутах.
 */
export function generateSlots({
  rules,
  busy = [],
  duration,
  from = Date.now(),
  days = BOOKING_HORIZON_DAYS,
  leadMin = BOOKING_LEAD_MIN,
}) {
  const earliest = from + leadMin * MINUTE;
  const out = new Map();
  const first = startOfDay(from);
  for (let i = 0; i < days; i++) {
    const day = addDays(first, i);
    const key = toDateKey(day);
    const weekday = day.getDay();
    for (const r of rules) {
      if (r.type === 'weekly' ? r.weekday !== weekday : r.date !== key) continue;
      const from = hhmmToMinutes(r.start);
      const to = hhmmToMinutes(r.end);
      for (let m = from; m + duration <= to; m += duration) {
        const start = atMinutes(day, m);
        const end = start + duration * MINUTE;
        if (start < earliest) continue;
        if (busy.some((b) => b.start < end && b.end > start)) continue;
        out.set(start, { start, end });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.start - b.start);
}

export function groupSlotsByDay(slots) {
  const map = new Map();
  for (const s of slots) {
    const key = toDateKey(s.start);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return map;
}
