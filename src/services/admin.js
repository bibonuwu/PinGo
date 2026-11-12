import { db } from '../lib/db';
import { batch, commit, commitEach, ref } from '../lib/remote';
import { BROADCAST_AUDIENCE_MAP, CERTIFICATE_MAP, isAdminEmail, normEmail } from '../lib/constants';
import { downloadFile, fmtDateYear, isEmail, plural, toDateKey, uid } from '../lib/utils';
import { kindLabel } from './profiles';
import { notifyRaw } from './notifications';
import { msg } from '../i18n/stored';
import { t } from '../i18n';

// Действия модератора: подтверждение волонтёров и специалистов, сертификаты, отзывы, рассылки, команда модераторов.

export const profileKind = (p) => (p?.published ?? p?.draft)?.kind ?? 'specialist';

function getProfile(id) {
  const p = db.profiles.peek(id);
  if (!p) throw new Error(t('Анкета не найдена'));
  return p;
}

function requireReason(reason) {
  const r = (reason || '').trim();
  if (r.length < 10) throw new Error(t('Укажите причину — минимум 10 символов'));
  return r;
}

// Рейтинг Pingo — байесовское среднее: пара отзывов «5» не обгоняет двадцать отзывов «4,8».
// Без отзывов — 4,0; каждый отзыв сдвигает оценку к реальной средней.
const PRIOR_RATING = 4;
const PRIOR_WEIGHT = 3;
export function ratingScore(reviews) {
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return (PRIOR_RATING * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + reviews.length);
}

export function averageRating(reviews) {
  return reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
}

// «12 часов», «1,5 часа» — для текстов сертификатов.
export function hoursText(minutes) {
  const h = Math.round((minutes / 60) * 10) / 10;
  if (!Number.isInteger(h)) return t('{replace} часа', { replace: String(h).replace('.', ',') });
  return `${h} ${plural(h, [t('час'), t('часа'), t('часов')])}`;
}

// ---------- Подтверждение ----------

// «Подтверждён Pingo»: модератор проверил человека — документы, занятия, отзывы. Отметку видят родители.
export async function verifyProfile(adminId, profileId) {
  const p = getProfile(profileId);
  if (!p.published) throw new Error(t('Подтвердить можно только анкету, опубликованную в каталоге'));
  if (p.verifiedAt) return;
  const now = Date.now();
  const volunteer = profileKind(p) === 'volunteer';
  const w = batch();
  w.update(ref('profiles', profileId), {
    verifiedAt: now,
    verifiedBy: adminId,
    updatedAt: now,
    history: [...p.history, { at: now, action: 'verified', by: adminId }],
  });
  w.update(ref('catalog', profileId), { verifiedAt: now });
  notifyRaw(w, profileId, {
    type: 'profile_verified',
    title: volunteer ? msg('Вы — подтверждённый волонтёр Pingo 💛') : msg('Вы — подтверждённый специалист Pingo 💛'),
    body: msg('Родители видят отметку «Подтверждён» в вашей анкете.'),
    link: '/specialist/profile',
  });
  await commit(w);
}

export async function unverifyProfile(adminId, profileId, reason) {
  const r = requireReason(reason);
  const p = getProfile(profileId);
  if (!p.verifiedAt) return;
  const now = Date.now();
  const w = batch();
  w.update(ref('profiles', profileId), {
    verifiedAt: null,
    verifiedBy: null,
    updatedAt: now,
    history: [...p.history, { at: now, action: 'unverified', by: adminId, reason: r }],
  });
  if (p.published) w.update(ref('catalog', profileId), { verifiedAt: null });
  notifyRaw(w, profileId, {
    type: 'profile_unverified',
    title: msg('Отметка «Подтверждён» снята'),
    body: r,
    link: '/specialist/profile',
  });
  await commit(w);
}

// ---------- Сертификаты ----------

export async function issueCertificate(admin, { userId, type, title, text }) {
  if (!CERTIFICATE_MAP[type]) throw new Error(t('Выберите вид сертификата'));
  const cleanTitle = (title || '').trim();
  if (cleanTitle.length < 3) throw new Error(t('Укажите название сертификата — минимум 3 символа'));
  const recipient = db.users.peek(userId);
  if (!recipient) throw new Error(t('Пользователь не найден'));
  const profile = db.profiles.peek(userId);
  const cert = {
    id: uid(),
    userId,
    type,
    title: cleanTitle.slice(0, 80),
    text: (text || '').trim().slice(0, 300),
    recipientName: recipient.name,
    recipientKind: profile ? profileKind(profile) : null,
    issuedBy: admin.id,
    issuedByName: admin.name,
    issuedAt: Date.now(),
  };
  const w = batch();
  w.set(ref('certificates', cert.id), cert);
  notifyRaw(w, userId, {
    type: 'certificate_issued',
    title: msg('Сертификат Pingo: {title} 🏅', { title: cert.title }),
    body: msg('Откройте, чтобы посмотреть и распечатать.'),
    link: `/certificate/${cert.id}`,
  });
  await commit(w);
  return cert;
}

export async function revokeCertificate(id) {
  await commit(batch().delete(ref('certificates', id)));
}

// ---------- Отзывы ----------

// Удалить отзыв, нарушающий правила (оскорбления, личные данные). Повторно по той же записи его не оставить.
export async function deleteReview(id) {
  await commit(batch().delete(ref('reviews', id)));
}

// ---------- Рассылки ----------

export function broadcastRecipients(audience) {
  const people = db.users.values().filter((u) => u.email && u.role !== 'admin');
  if (audience === 'parents') return people.filter((u) => u.role === 'parent');
  if (audience === 'specialists') return people.filter((u) => u.role === 'specialist');
  if (audience === 'volunteers') {
    return people.filter((u) => u.role === 'specialist' && profileKind(db.profiles.peek(u.id)) === 'volunteer');
  }
  return people;
}

// Сообщение — это обычное уведомление каждому адресату; в broadcasts остаётся запись для истории.
export async function sendBroadcast(admin, { audience, title, body }) {
  if (!BROADCAST_AUDIENCE_MAP[audience]) throw new Error(t('Выберите, кому отправить'));
  const cleanTitle = (title || '').trim();
  const b = (body || '').trim();
  if (cleanTitle.length < 3) throw new Error(t('Заголовок — минимум 3 символа'));
  const list = broadcastRecipients(audience);
  if (!list.length) throw new Error(t('В этой группе пока нет пользователей'));
  const now = Date.now();
  await commitEach(list, (w, u) => notifyRaw(w, u.id, { type: 'announcement', title: cleanTitle.slice(0, 80), body: b.slice(0, 500), createdAt: now }));
  const id = uid();
  await commit(
    batch().set(ref('broadcasts', id), {
      id,
      audience,
      title: t.slice(0, 80),
      body: b.slice(0, 500),
      count: list.length,
      sentBy: admin.id,
      sentByName: admin.name,
      sentAt: now,
    }),
  );
  return list.length;
}

// ---------- Модераторы ----------

// Основатели (ADMIN_EMAILS) — модераторы всегда; остальных модераторы добавляют по почте: moderators/{email}.
const accountByEmail = (email) => db.users.values().find((u) => u.email === email);

// Доступ откроется, когда человек войдёт в Pingo с этой почтой (подтверждённой). Если аккаунт уже есть,
// он станет аккаунтом модератора (см. claimAdmin в services/auth.js) — прямо в открытом приложении.
export async function addModerator(admin, email) {
  const e = normEmail(email);
  if (!isEmail(e)) throw new Error(t('Проверьте адрес электронной почты'));
  if (isAdminEmail(e) || db.moderators.peek(e)) throw new Error(t('{email} уже в команде модераторов', { email: e }));
  const w = batch();
  w.set(ref('moderators', e), { email: e, addedBy: admin.id, addedByName: admin.name, createdAt: Date.now() });
  const account = accountByEmail(e);
  if (account) {
    notifyRaw(w, account.id, {
      type: 'moderator_added',
      title: msg('Вы — модератор Pingo'),
      body: msg('{name} добавил(а) вас в команду модераторов.', { name: admin.name }),
      link: '/admin',
    });
  }
  await commit(w);
}

// Убрать модератора. Основателей и себя убрать нельзя (себя — чтобы случайно не потерять доступ).
// Если аккаунт уже стал аккаунтом модератора, возвращаем ему обычную роль: специалист, если у него
// есть анкета, иначе родитель. Иначе он остался бы с ролью admin — без доступа, но с уведомлениями модераторов.
export async function removeModerator(admin, email) {
  const e = normEmail(email);
  if (isAdminEmail(e)) throw new Error(t('Основателя Pingo убрать нельзя'));
  if (e === normEmail(admin.email)) throw new Error(t('Себя убрать нельзя — попросите другого модератора'));
  const w = batch();
  w.delete(ref('moderators', e));
  const account = accountByEmail(e);
  if (account?.role === 'admin') {
    const role = db.profiles.peek(account.id) ? 'specialist' : 'parent';
    w.update(ref('users', account.id), { role });
    w.update(ref('people', account.id), { role });
  }
  await commit(w);
}

// ---------- Экспорт ----------

const ROLE_LABELS = { parent: t('Родитель'), specialist: t('Специалист / волонтёр'), admin: t('Модератор') };
const STATUS_LABELS = { draft: t('Черновик'), pending: t('На модерации'), approved: t('Одобрена'), rejected: t('Отклонена') };

// CSV для Excel: разделитель «;» и BOM, чтобы кириллица открылась без настройки.
export function exportUsersCsv(users) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = [t('Имя'), 'Email', t('Роль'), t('Тип анкеты'), t('Анкета'), t('Подтверждён'), t('Зарегистрирован')];
  const rows = users.map((u) => {
    const p = u.role === 'specialist' ? db.profiles.peek(u.id) : null;
    return [
      u.name,
      u.email,
      ROLE_LABELS[u.role] ?? u.role,
      p ? kindLabel(profileKind(p)) : '',
      p ? STATUS_LABELS[p.status] ?? p.status : '',
      p?.verifiedAt ? fmtDateYear(p.verifiedAt) : '',
      u.createdAt ? fmtDateYear(u.createdAt) : '',
    ];
  });
  const csv = [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  downloadFile(`pingo-users-${toDateKey(Date.now())}.csv`, `﻿${csv}`, 'text/csv;charset=utf-8');
}
