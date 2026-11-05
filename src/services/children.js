import { db } from '../lib/db';
import { batch, commit, ref, update } from '../lib/remote';
import { DEFAULT_A11Y } from '../lib/constants';
import { isActiveBooking } from '../lib/slots';
import { ageFromBirthDate, uid } from '../lib/utils';
import { t } from '../i18n';

export function emptyChild() {
  return {
    avatar: 'raincoat',
    name: '',
    birthDate: '',
    needs: [],
    needsOther: '',
    learningStyles: [],
    goals: '',
    notes: '',
    accessibility: { ...DEFAULT_A11Y },
  };
}

export function childIssues(data) {
  const issues = {};
  const name = (data.name || '').trim();
  if (name.length < 2) issues.name = t('Введите имя ребёнка');
  else if (name.length > 40) issues.name = t('Имя слишком длинное');
  if (!data.birthDate) issues.birthDate = t('Укажите дату рождения');
  else {
    const age = ageFromBirthDate(data.birthDate);
    if (age < 1 || age > 18) issues.birthDate = t('Pingo помогает детям от 1 до 18 лет');
  }
  if (data.needs?.includes('other') && !(data.needsOther || '').trim()) issues.needsOther = t('Опишите, с чем нужна помощь');
  return issues;
}

function clean(data) {
  return {
    avatar: data.avatar,
    name: data.name.trim(),
    birthDate: data.birthDate,
    needs: data.needs,
    needsOther: data.needs.includes('other') ? data.needsOther.trim() : '',
    learningStyles: data.learningStyles,
    goals: data.goals.trim(),
    notes: data.notes.trim(),
    accessibility: { ...DEFAULT_A11Y, ...data.accessibility },
  };
}

export async function createChild(parentId, data, { consent }) {
  const issues = childIssues(data);
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  if (!consent) throw new Error(t('Подтвердите согласие законного представителя'));
  const now = Date.now();
  // specialistIds — специалисты, у которых есть записи с ребёнком: только они видят его профиль.
  const child = { id: uid(), parentId, ...clean(data), specialistIds: [], consentAt: now, createdAt: now, updatedAt: now };
  const w = batch();
  w.set(ref('children', child.id), child);
  if (!db.users.peek(parentId)?.activeChildId) w.update(ref('users', parentId), { activeChildId: child.id });
  await commit(w);
  return child;
}

export async function updateChild(id, data) {
  const issues = childIssues(data);
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  await update('children', id, { ...clean(data), updatedAt: Date.now() });
}

export async function updateChildAccessibility(id, accessibility) {
  await update('children', id, { accessibility, updatedAt: Date.now() });
}

export function setActiveChild(parentId, childId) {
  return update('users', parentId, { activeChildId: childId });
}

export async function deleteChild(parentId, childId) {
  const child = db.children.peek(childId);
  if (!child || child.parentId !== parentId) throw new Error(t('Профиль ребёнка не найден'));
  const now = Date.now();
  const active = (await db.bookings.where('childId').equals(childId).toArray()).some(
    (b) => isActiveBooking(b) && b.end > now,
  );
  if (active) throw new Error(t('Сначала отмените активные записи ребёнка ({name})', { name: child.name }));
  const w = batch();
  w.delete(ref('children', childId));
  if (db.users.peek(parentId)?.activeChildId === childId) {
    const next = (await db.children.where('parentId').equals(parentId).toArray()).find((c) => c.id !== childId);
    w.update(ref('users', parentId), { activeChildId: next?.id ?? null });
  }
  await commit(w);
}
