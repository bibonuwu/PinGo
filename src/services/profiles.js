import { arrayUnion } from 'firebase/firestore';
import { db } from '../lib/db';
import { batch, commit, ref, update } from '../lib/remote';
import {
  FORMAT_MAP,
  LANGUAGE_MAP,
  MAX_SPECIALIZATIONS,
  PROFILE_KINDS,
  SPECIALIZATION_MAP,
  TRAINING_MODULES,
} from '../lib/constants';
import { notifyAdminsRaw, notifyRaw } from './notifications';
import { msg } from '../i18n/stored';
import { t } from '../i18n';

// Анкета специалиста/волонтёра.
// draft — то, что редактирует специалист; published — последняя одобренная версия (её видят родители).
// Статусы: draft → pending → approved | rejected. Правка одобренной анкеты не скрывает её из каталога:
// родители видят прежнюю версию, пока модератор не одобрит изменения.
// Хранение: profiles/{uid} — вся анкета (видят владелец и модератор);
// catalog/{uid} — опубликованная версия без документов (её видят родители).

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

export const kindLabel = (kind) => PROFILE_KINDS.find((k) => k.id === kind)?.label ?? t('Специалист');

export function trainingProgress(profile) {
  const done = TRAINING_MODULES.filter((m) => profile?.trainingDone?.includes(m.id)).length;
  return { done, total: TRAINING_MODULES.length, complete: done === TRAINING_MODULES.length };
}

// Что мешает отправить анкету на модерацию.
export function profileIssues(profile) {
  const d = profile.draft;
  const issues = [];
  if (d.title.trim().length < 5) issues.push({ field: 'title', text: t('Добавьте заголовок анкеты (от 5 символов)') });
  if (d.description.trim().length < 60)
    issues.push({ field: 'description', text: t('Расскажите о себе подробнее (от 60 символов)') });
  if (d.kind === 'specialist' && d.experienceText.trim().length < 20)
    issues.push({ field: 'experience', text: t('Опишите образование и опыт (от 20 символов)') });
  if (!d.specializations.length) issues.push({ field: 'specializations', text: t('Выберите хотя бы одну специализацию') });
  if (d.specializations.length > MAX_SPECIALIZATIONS)
    issues.push({ field: 'specializations', text: t('Не больше {MAX_SPECIALIZATIONS} специализаций', { MAX_SPECIALIZATIONS }) });
  if (d.ageMin > d.ageMax) issues.push({ field: 'age', text: t('Проверьте возраст детей: «от» больше, чем «до»') });
  if (!d.formats.length) issues.push({ field: 'formats', text: t('Выберите формат занятий') });
  if (d.formats.includes('offline') && !d.city.trim())
    issues.push({ field: 'formats', text: t('Укажите город для очных занятий') });
  if (!d.languages.length) issues.push({ field: 'languages', text: t('Укажите язык занятий') });
  if (!trainingProgress(profile).complete) issues.push({ field: 'training', text: t('Пройдите обучение Pingo') });
  if (!d.agreements.truth || !d.agreements.safety)
    issues.push({ field: 'agreements', text: t('Подтвердите достоверность данных и правила безопасности') });
  return issues;
}

const FIELD_LABELS = {
  kind: t('Тип анкеты'),
  title: t('Заголовок'),
  description: t('Описание'),
  experienceYears: t('Стаж'),
  experienceText: t('Опыт и образование'),
  specializations: t('Специализации'),
  ageMin: t('Возраст детей'),
  ageMax: t('Возраст детей'),
  formats: t('Формат'),
  city: t('Город'),
  languages: t('Языки'),
  documents: t('Документы'),
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

function getOwnProfile(userId) {
  const p = db.profiles.peek(userId);
  if (!p) throw new Error(t('Анкета не найдена'));
  return p;
}

// Документы (дипломы) видит только модератор — в каталог они не попадают.
// verifiedAt — отметка «Подтверждён Pingo» (её ставит модератор, см. services/admin.js).
const catalogEntry = (id, published, sessionMinutes, verifiedAt, now) => ({
  id,
  published: { ...published, documents: [] },
  sessionMinutes,
  verifiedAt: verifiedAt ?? null,
  updatedAt: now,
});

// Автосохранение: пишем только изменённые поля черновика, чтобы быстрые правки не затирали друг друга.
export async function saveDraft(userId, patch) {
  const p = getOwnProfile(userId);
  if (p.status === 'pending') throw new Error(t('Анкета на проверке — отзовите её, чтобы редактировать'));
  const fields = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`draft.${k}`, v]));
  await update('profiles', userId, { ...fields, updatedAt: Date.now() });
}

export async function setSessionMinutes(userId, minutes) {
  const p = getOwnProfile(userId);
  const now = Date.now();
  const w = batch();
  w.update(ref('profiles', userId), { sessionMinutes: minutes, updatedAt: now });
  if (p.published) w.update(ref('catalog', userId), { sessionMinutes: minutes, updatedAt: now });
  await commit(w);
}

export async function completeTrainingModule(userId, moduleId) {
  const p = getOwnProfile(userId);
  if (p.trainingDone.includes(moduleId)) return;
  await update('profiles', userId, { trainingDone: arrayUnion(moduleId), updatedAt: Date.now() });
}

export async function submitProfile(userId) {
  const p = getOwnProfile(userId);
  if (p.status === 'pending') throw new Error(t('Анкета уже на проверке'));
  const issues = profileIssues(p);
  if (issues.length) throw new Error(issues[0].text);
  const now = Date.now();
  const user = db.users.peek(userId);
  const w = batch();
  w.update(ref('profiles', userId), {
    status: 'pending',
    submittedAt: now,
    rejectionReason: null,
    updatedAt: now,
    history: [...p.history, { at: now, action: 'submitted', by: userId }],
  });
  await notifyAdminsRaw(w, {
    type: 'profile_submitted',
    title: p.published ? msg('Изменения в анкете на модерации') : msg('Новая анкета на модерации'),
    body: msg('{name} · {kind}', { name: user?.name ?? { t: 'Пользователь' }, kind: { label: 'profileKind', id: p.draft.kind } }),
    link: `/admin/profiles/${userId}`,
  });
  await commit(w);
}

export async function withdrawProfile(userId) {
  const p = getOwnProfile(userId);
  if (p.status !== 'pending') return;
  const now = Date.now();
  await update('profiles', userId, {
    status: p.published ? 'approved' : 'draft',
    updatedAt: now,
    history: [...p.history, { at: now, action: 'withdrawn', by: userId }],
  });
}

function requireReason(reason) {
  const r = (reason || '').trim();
  if (r.length < 10) throw new Error(t('Укажите причину — минимум 10 символов'));
  return r;
}

function getProfile(profileId) {
  const p = db.profiles.peek(profileId);
  if (!p) throw new Error(t('Анкета не найдена'));
  return p;
}

export async function approveProfile(adminId, profileId) {
  const p = getProfile(profileId);
  if (p.status !== 'pending') throw new Error(t('Одобрить можно только анкету на модерации'));
  const now = Date.now();
  const published = structuredClone(p.draft);
  const w = batch();
  w.update(ref('profiles', profileId), {
    status: 'approved',
    published,
    rejectionReason: null,
    reviewedAt: now,
    reviewedBy: adminId,
    updatedAt: now,
    history: [...p.history, { at: now, action: 'approved', by: adminId }],
  });
  w.set(ref('catalog', profileId), catalogEntry(profileId, published, p.sessionMinutes, p.verifiedAt, now));
  notifyRaw(w, profileId, {
    type: 'profile_approved',
    title: msg('Анкета одобрена 🎉'),
    body: p.published ? msg('Изменения опубликованы в каталоге.') : msg('Теперь родители видят вас в каталоге и могут записаться.'),
    link: '/specialist/profile',
  });
  await commit(w);
}

export async function rejectProfile(adminId, profileId, reason) {
  const r = requireReason(reason);
  const p = getProfile(profileId);
  if (p.status !== 'pending') throw new Error(t('Отклонить можно только анкету на модерации'));
  const now = Date.now();
  const w = batch();
  w.update(ref('profiles', profileId), {
    status: 'rejected',
    rejectionReason: r,
    reviewedAt: now,
    reviewedBy: adminId,
    updatedAt: now,
    history: [...p.history, { at: now, action: 'rejected', by: adminId, reason: r }],
  });
  notifyRaw(w, profileId, {
    type: 'profile_rejected',
    title: p.published ? msg('Изменения в анкете отклонены') : msg('Анкета отклонена'),
    body: r,
    link: '/specialist/profile',
  });
  await commit(w);
}

// Снять одобренную анкету с публикации (например, после жалобы).
export async function revokeProfile(adminId, profileId, reason) {
  const r = requireReason(reason);
  const p = getProfile(profileId);
  if (!p.published) throw new Error(t('Анкета не опубликована'));
  const now = Date.now();
  const w = batch();
  w.update(ref('profiles', profileId), {
    status: 'rejected',
    published: null,
    rejectionReason: r,
    reviewedAt: now,
    reviewedBy: adminId,
    updatedAt: now,
    history: [...p.history, { at: now, action: 'revoked', by: adminId, reason: r }],
  });
  w.delete(ref('catalog', profileId));
  notifyRaw(w, profileId, {
    type: 'profile_revoked',
    title: msg('Анкета снята с публикации'),
    body: r,
    link: '/specialist/profile',
  });
  await commit(w);
}
