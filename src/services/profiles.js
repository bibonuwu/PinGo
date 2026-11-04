import { db } from '../lib/db';
import {
  FORMAT_MAP,
  LANGUAGE_MAP,
  MAX_SPECIALIZATIONS,
  PROFILE_KINDS,
  SPECIALIZATION_MAP,
  TRAINING_MODULES,
} from '../lib/constants';
import { notifyAdminsRaw, notifyRaw } from './notifications';

// Анкета специалиста/волонтёра.
// draft — то, что редактирует специалист; published — последняя одобренная версия (её видят родители).
// Статусы: draft → pending → approved | rejected. Правка одобренной анкеты не скрывает её из каталога:
// родители видят прежнюю версию, пока модератор не одобрит изменения.

export function emptyProfileData() {
  return {
    kind: 'specialist',
    title: '',
    description: '',
    experienceYears: 0,
    experienceText: '',
    specializations: [],
    ageMin: 3,
    ageMax: 12,
    formats: ['online'],
    city: '',
    languages: ['ru'],
    documents: [],
    agreements: { truth: false, safety: false },
  };
}

export function newProfile(userId, now = Date.now()) {
  return {
    id: userId,
    status: 'draft',
    draft: emptyProfileData(),
    published: null,
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    trainingDone: [],
    sessionMinutes: 45,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const kindLabel = (kind) => PROFILE_KINDS.find((k) => k.id === kind)?.label ?? 'Специалист';

export function trainingProgress(profile) {
  const done = TRAINING_MODULES.filter((m) => profile?.trainingDone?.includes(m.id)).length;
  return { done, total: TRAINING_MODULES.length, complete: done === TRAINING_MODULES.length };
}

// Что мешает отправить анкету на модерацию.
export function profileIssues(profile) {
  const d = profile.draft;
  const issues = [];
  if (d.title.trim().length < 5) issues.push({ field: 'title', text: 'Добавьте заголовок анкеты (от 5 символов)' });
  if (d.description.trim().length < 60)
    issues.push({ field: 'description', text: 'Расскажите о себе подробнее (от 60 символов)' });
  if (d.kind === 'specialist' && d.experienceText.trim().length < 20)
    issues.push({ field: 'experience', text: 'Опишите образование и опыт (от 20 символов)' });
  if (!d.specializations.length) issues.push({ field: 'specializations', text: 'Выберите хотя бы одну специализацию' });
  if (d.specializations.length > MAX_SPECIALIZATIONS)
    issues.push({ field: 'specializations', text: `Не больше ${MAX_SPECIALIZATIONS} специализаций` });
  if (d.ageMin > d.ageMax) issues.push({ field: 'age', text: 'Проверьте возраст детей: «от» больше, чем «до»' });
  if (!d.formats.length) issues.push({ field: 'formats', text: 'Выберите формат занятий' });
  if (d.formats.includes('offline') && !d.city.trim())
    issues.push({ field: 'formats', text: 'Укажите город для очных занятий' });
  if (!d.languages.length) issues.push({ field: 'languages', text: 'Укажите язык занятий' });
  if (!trainingProgress(profile).complete) issues.push({ field: 'training', text: 'Пройдите обучение Pingo' });
  if (!d.agreements.truth || !d.agreements.safety)
    issues.push({ field: 'agreements', text: 'Подтвердите достоверность данных и правила безопасности' });
  return issues;
}

const FIELD_LABELS = {
  kind: 'Тип анкеты',
  title: 'Заголовок',
  description: 'Описание',
  experienceYears: 'Стаж',
  experienceText: 'Опыт и образование',
  specializations: 'Специализации',
  ageMin: 'Возраст детей',
  ageMax: 'Возраст детей',
  formats: 'Формат',
  city: 'Город',
  languages: 'Языки',
  documents: 'Документы',
};

// Какие поля изменились относительно опубликованной версии — для модератора.
export function changedFields(profile) {
  if (!profile?.published) return [];
  const out = new Set();
  for (const key of Object.keys(FIELD_LABELS)) {
    const a = JSON.stringify(profile.draft[key] ?? null);
    const b = JSON.stringify(profile.published[key] ?? null);
    if (a !== b) out.add(FIELD_LABELS[key]);
  }
  return [...out];
}

export function describeProfile(data) {
  return {
    specializations: data.specializations.map((id) => SPECIALIZATION_MAP[id]?.label).filter(Boolean),
    formats: data.formats.map((id) => FORMAT_MAP[id]?.label).filter(Boolean),
    languages: data.languages.map((id) => LANGUAGE_MAP[id]?.label).filter(Boolean),
  };
}

async function getOwnProfile(userId) {
  const p = await db.profiles.get(userId);
  if (!p) throw new Error('Анкета не найдена');
  return p;
}

export async function saveDraft(userId, patch) {
  return db.transaction('rw', db.profiles, async () => {
    const p = await getOwnProfile(userId);
    if (p.status === 'pending') throw new Error('Анкета на проверке — отзовите её, чтобы редактировать');
    await db.profiles.update(userId, { draft: { ...p.draft, ...patch }, updatedAt: Date.now() });
  });
}

export async function setSessionMinutes(userId, minutes) {
  await db.profiles.update(userId, { sessionMinutes: minutes, updatedAt: Date.now() });
}

export async function completeTrainingModule(userId, moduleId) {
  return db.transaction('rw', db.profiles, async () => {
    const p = await getOwnProfile(userId);
    if (p.trainingDone.includes(moduleId)) return;
    await db.profiles.update(userId, { trainingDone: [...p.trainingDone, moduleId], updatedAt: Date.now() });
  });
}

export async function submitProfile(userId) {
  return db.transaction('rw', db.profiles, db.users, db.notifications, async () => {
    const p = await getOwnProfile(userId);
    if (p.status === 'pending') throw new Error('Анкета уже на проверке');
    const issues = profileIssues(p);
    if (issues.length) throw new Error(issues[0].text);
    const now = Date.now();
    const user = await db.users.get(userId);
    await db.profiles.update(userId, {
      status: 'pending',
      submittedAt: now,
      rejectionReason: null,
      updatedAt: now,
      history: [...p.history, { at: now, action: 'submitted', by: userId }],
    });
    await notifyAdminsRaw({
      type: 'profile_submitted',
      title: p.published ? 'Изменения в анкете на модерации' : 'Новая анкета на модерации',
      body: `${user?.name ?? 'Пользователь'} · ${kindLabel(p.draft.kind).toLowerCase()}`,
      link: `/admin/profiles/${userId}`,
    });
  });
}

export async function withdrawProfile(userId) {
  return db.transaction('rw', db.profiles, async () => {
    const p = await getOwnProfile(userId);
    if (p.status !== 'pending') return;
    const now = Date.now();
    await db.profiles.update(userId, {
      status: p.published ? 'approved' : 'draft',
      updatedAt: now,
      history: [...p.history, { at: now, action: 'withdrawn', by: userId }],
    });
  });
}

function requireReason(reason) {
  const r = (reason || '').trim();
  if (r.length < 10) throw new Error('Укажите причину — минимум 10 символов');
  return r;
}

export async function approveProfile(adminId, profileId) {
  return db.transaction('rw', db.profiles, db.notifications, async () => {
    const p = await db.profiles.get(profileId);
    if (!p) throw new Error('Анкета не найдена');
    if (p.status !== 'pending') throw new Error('Одобрить можно только анкету на модерации');
    const now = Date.now();
    await db.profiles.update(profileId, {
      status: 'approved',
      published: structuredClone(p.draft),
      rejectionReason: null,
      reviewedAt: now,
      reviewedBy: adminId,
      updatedAt: now,
      history: [...p.history, { at: now, action: 'approved', by: adminId }],
    });
    await notifyRaw(profileId, {
      type: 'profile_approved',
      title: 'Анкета одобрена 🎉',
      body: p.published ? 'Изменения опубликованы в каталоге.' : 'Теперь родители видят вас в каталоге и могут записаться.',
      link: '/specialist/profile',
    });
  });
}

export async function rejectProfile(adminId, profileId, reason) {
  const r = requireReason(reason);
  return db.transaction('rw', db.profiles, db.notifications, async () => {
    const p = await db.profiles.get(profileId);
    if (!p) throw new Error('Анкета не найдена');
    if (p.status !== 'pending') throw new Error('Отклонить можно только анкету на модерации');
    const now = Date.now();
    await db.profiles.update(profileId, {
      status: 'rejected',
      rejectionReason: r,
      reviewedAt: now,
      reviewedBy: adminId,
      updatedAt: now,
      history: [...p.history, { at: now, action: 'rejected', by: adminId, reason: r }],
    });
    await notifyRaw(profileId, {
      type: 'profile_rejected',
      title: p.published ? 'Изменения в анкете отклонены' : 'Анкета отклонена',
      body: r,
      link: '/specialist/profile',
    });
  });
}

// Снять одобренную анкету с публикации (например, после жалобы).
export async function revokeProfile(adminId, profileId, reason) {
  const r = requireReason(reason);
  return db.transaction('rw', db.profiles, db.notifications, async () => {
    const p = await db.profiles.get(profileId);
    if (!p?.published) throw new Error('Анкета не опубликована');
    const now = Date.now();
    await db.profiles.update(profileId, {
      status: 'rejected',
      published: null,
      rejectionReason: r,
      reviewedAt: now,
      reviewedBy: adminId,
      updatedAt: now,
      history: [...p.history, { at: now, action: 'revoked', by: adminId, reason: r }],
    });
    await notifyRaw(profileId, {
      type: 'profile_revoked',
      title: 'Анкета снята с публикации',
      body: r,
      link: '/specialist/profile',
    });
  });
}
