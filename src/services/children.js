import { db } from '../lib/db';
import { DEFAULT_A11Y } from '../lib/constants';
import { isActiveBooking } from '../lib/slots';
import { ageFromBirthDate, uid } from '../lib/utils';

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
  if (name.length < 2) issues.name = 'Введите имя ребёнка';
  else if (name.length > 40) issues.name = 'Имя слишком длинное';
  if (!data.birthDate) issues.birthDate = 'Укажите дату рождения';
  else {
    const age = ageFromBirthDate(data.birthDate);
    if (age < 1 || age > 18) issues.birthDate = 'Pingo помогает детям от 1 до 18 лет';
  }
  if (data.needs?.includes('other') && !(data.needsOther || '').trim()) issues.needsOther = 'Опишите, с чем нужна помощь';
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
  if (!consent) throw new Error('Подтвердите согласие законного представителя');
  const now = Date.now();
  const child = { id: uid(), parentId, ...clean(data), consentAt: now, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.children, db.users, async () => {
    await db.children.add(child);
    const parent = await db.users.get(parentId);
    if (!parent.activeChildId) await db.users.update(parentId, { activeChildId: child.id });
  });
  return child;
}

export async function updateChild(id, data) {
  const issues = childIssues(data);
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  await db.children.update(id, { ...clean(data), updatedAt: Date.now() });
}

export async function updateChildAccessibility(id, accessibility) {
  await db.children.update(id, { accessibility, updatedAt: Date.now() });
}

export function setActiveChild(parentId, childId) {
  return db.users.update(parentId, { activeChildId: childId });
}

export async function deleteChild(parentId, childId) {
  return db.transaction('rw', db.children, db.users, db.bookings, async () => {
    const child = await db.children.get(childId);
    if (!child || child.parentId !== parentId) throw new Error('Профиль ребёнка не найден');
    const now = Date.now();
    const active = (await db.bookings.where('childId').equals(childId).toArray()).some(
      (b) => isActiveBooking(b) && b.end > now,
    );
    if (active) throw new Error(`Сначала отмените активные записи для ${child.name}`);
    await db.children.delete(childId);
    const parent = await db.users.get(parentId);
    if (parent.activeChildId === childId) {
      const next = await db.children.where('parentId').equals(parentId).first();
      await db.users.update(parentId, { activeChildId: next?.id ?? null });
    }
  });
}
