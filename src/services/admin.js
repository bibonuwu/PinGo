import { db } from '../lib/db';
import { batch, commit, commitEach, ref } from '../lib/remote';
import { BROADCAST_AUDIENCE_MAP, CERTIFICATE_MAP } from '../lib/constants';
import { downloadFile, fmtDateYear, plural, toDateKey, uid } from '../lib/utils';
import { kindLabel } from './profiles';
import { notifyRaw } from './notifications';

// Действия модератора: подтверждение волонтёров и специалистов, сертификаты, отзывы, рассылки.

export const profileKind = (p) => (p?.published ?? p?.draft)?.kind ?? 'specialist';

function getProfile(id) {
  const p = db.profiles.peek(id);
  if (!p) throw new Error('Анкета не найдена');
  return p;
}

function requireReason(reason) {
  const r = (reason || '').trim();
  if (r.length < 10) throw new Error('Укажите причину — минимум 10 символов');
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
  if (!Number.isInteger(h)) return `${String(h).replace('.', ',')} часа`;
  return `${h} ${plural(h, ['час', 'часа', 'часов'])}`;
}

// ---------- Подтверждение ----------

// «Подтверждён Pingo»: модератор проверил человека — документы, занятия, отзывы. Отметку видят родители.
export async function verifyProfile(adminId, profileId) {
  const p = getProfile(profileId);
  if (!p.published) throw new Error('Подтвердить можно только анкету, опубликованную в каталоге');
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
    title: volunteer ? 'Вы — подтверждённый волонтёр Pingo 💛' : 'Вы — подтверждённый специалист Pingo 💛',
    body: 'Родители видят отметку «Подтверждён» в вашей анкете.',
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
    title: 'Отметка «Подтверждён» снята',
    body: r,
    link: '/specialist/profile',
  });
  await commit(w);
}

// ---------- Сертификаты ----------

export async function issueCertificate(admin, { userId, type, title, text }) {
  if (!CERTIFICATE_MAP[type]) throw new Error('Выберите вид сертификата');
  const t = (title || '').trim();
  if (t.length < 3) throw new Error('Укажите название сертификата — минимум 3 символа');
  const recipient = db.users.peek(userId);
  if (!recipient) throw new Error('Пользователь не найден');
  const profile = db.profiles.peek(userId);
  const cert = {
    id: uid(),
    userId,
    type,
    title: t.slice(0, 80),
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
    title: `Сертификат Pingo: ${cert.title} 🏅`,
    body: 'Откройте, чтобы посмотреть и распечатать.',
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
  if (!BROADCAST_AUDIENCE_MAP[audience]) throw new Error('Выберите, кому отправить');
  const t = (title || '').trim();
  const b = (body || '').trim();
  if (t.length < 3) throw new Error('Заголовок — минимум 3 символа');
  const list = broadcastRecipients(audience);
  if (!list.length) throw new Error('В этой группе пока нет пользователей');
  const now = Date.now();
  await commitEach(list, (w, u) => notifyRaw(w, u.id, { type: 'announcement', title: t.slice(0, 80), body: b.slice(0, 500), createdAt: now }));
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

// ---------- Экспорт ----------

const ROLE_LABELS = { parent: 'Родитель', specialist: 'Специалист / волонтёр', admin: 'Модератор' };
const STATUS_LABELS = { draft: 'Черновик', pending: 'На модерации', approved: 'Одобрена', rejected: 'Отклонена' };

// CSV для Excel: разделитель «;» и BOM, чтобы кириллица открылась без настройки.
export function exportUsersCsv(users) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Имя', 'Email', 'Роль', 'Тип анкеты', 'Анкета', 'Подтверждён', 'Зарегистрирован'];
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
