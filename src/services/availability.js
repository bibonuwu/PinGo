import { db } from '../lib/db';
import { batch, commit, ref } from '../lib/remote';
import { hhmmToMinutes, toDateKey, uid } from '../lib/utils';

// type: 'weekly' — повторяется каждую неделю (weekday 0–6, 0 = воскресенье);
// type: 'date' — разовое окно на конкретную дату.
export async function addAvailability(specialistId, { type, weekday, date, start, end }) {
  if (!start || !end) throw new Error('Укажите время начала и конца');
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  if (e <= s) throw new Error('Конец окна должен быть позже начала');
  if (e - s < 30) throw new Error('Окно должно быть не короче 30 минут');
  if (type === 'date') {
    if (!date) throw new Error('Выберите дату');
    if (date < toDateKey(Date.now())) throw new Error('Нельзя добавить окно в прошлом');
  } else if (type !== 'weekly' || weekday == null) {
    throw new Error('Выберите день недели');
  }

  const rules = await db.availability.where('specialistId').equals(specialistId).toArray();
  const sameDay = rules.filter((r) => r.type === type && (type === 'weekly' ? r.weekday === weekday : r.date === date));
  const clash = sameDay.find((r) => hhmmToMinutes(r.start) < e && hhmmToMinutes(r.end) > s);
  if (clash) throw new Error(`Пересекается с окном ${clash.start}–${clash.end}`);
  const rule = {
    id: uid(),
    specialistId,
    type,
    weekday: type === 'weekly' ? weekday : null,
    date: type === 'date' ? date : null,
    start,
    end,
    createdAt: Date.now(),
  };
  await commit(batch().set(ref('availability', rule.id), rule));
  return rule;
}

export function removeAvailability(id) {
  return commit(batch().delete(ref('availability', id)));
}
