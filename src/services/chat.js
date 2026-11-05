import { increment } from 'firebase/firestore';
import { db } from '../lib/db';
import { batch, commit, ref, update } from '../lib/remote';
import { uid } from '../lib/utils';
import { notifyRaw } from './notifications';

export const MAX_MESSAGE_LENGTH = 2000;

// Диалог поддержки (kind: 'support', adminId) — модератор пишет родителю или специалисту.
// Модератор занимает свободное место: у родителя — место специалиста, у специалиста — место родителя.
// Поэтому у собеседника всё работает как в обычном чате, а модератор слушает оба поля.
export const SUPPORT = 'support';

export const conversationIdFor = (parentId, specialistId) => `c_${parentId}_${specialistId}`;

export const supportConversationId = (adminId, person) =>
  person.role === 'parent' ? conversationIdFor(person.id, adminId) : conversationIdFor(adminId, person.id);

// Модератор диалога поддержки (null — обычный диалог). В первых диалогах поддержки adminId не было,
// там модератор всегда на месте специалиста.
export const supportAdminOf = (c) => (c?.kind === SUPPORT ? (c.adminId ?? c.specialistId) : null);

// Модератор открывает чат с пользователем (сам диалог создастся с первым сообщением).
export const supportChatPath = (adminId, person) => `/admin/messages/${supportConversationId(adminId, person)}`;

// Обратное к conversationIdFor: uid в Firebase не содержат «_».
export function parseConversationId(id) {
  const m = /^c_([^_]+)_([^_]+)$/.exec(id ?? '');
  return m ? { parentId: m[1], specialistId: m[2] } : null;
}

// Добавляет в пакет создание диалога, если его ещё нет. Возвращает { id, parentId, specialistId }.
// extra — дополнительные поля нового диалога (у диалога поддержки — kind и adminId).
export function ensureConversationRaw(w, parentId, specialistId, extra = null) {
  const id = conversationIdFor(parentId, specialistId);
  if (!db.conversations.peek(id)) {
    const now = Date.now();
    w.set(
      ref('conversations', id),
      { id, parentId, specialistId, createdAt: now, updatedAt: now, lastText: '', lastSenderId: null, ...extra },
      { merge: true },
    );
  }
  return { id, parentId, specialistId, ...extra };
}

// Черновик диалога поддержки: в Firestore он появится вместе с первым сообщением модератора,
// чтобы у пользователя не висел пустой диалог, если модератор открыл чат и ничего не написал.
export function supportDraft(adminId, person) {
  const parent = person.role === 'parent';
  return {
    id: supportConversationId(adminId, person),
    parentId: parent ? person.id : adminId,
    specialistId: parent ? adminId : person.id,
    kind: SUPPORT,
    adminId,
    unread: {},
    updatedAt: Date.now(),
    lastText: '',
    lastSenderId: null,
    draft: true,
  };
}

export async function ensureConversation(parentId, specialistId) {
  const w = batch();
  const conv = ensureConversationRaw(w, parentId, specialistId);
  await commit(w);
  return conv.id;
}

// kind: 'text' | 'system'. unreadFor — кому увеличить счётчик непрочитанного.
// В сообщении хранятся участники диалога — по ним правила безопасности решают, кому его показать.
export function pushMessageRaw(
  w,
  conv,
  { senderId, text, kind = 'text', bookingId = null, unreadFor = [], createdAt = Date.now() },
) {
  const msg = {
    id: uid(),
    conversationId: conv.id,
    parentId: conv.parentId,
    specialistId: conv.specialistId,
    senderId,
    text,
    kind,
    bookingId,
    createdAt,
  };
  w.set(ref('messages', msg.id), msg);
  const patch = {
    id: conv.id,
    parentId: conv.parentId,
    specialistId: conv.specialistId,
    updatedAt: createdAt,
    lastText: text,
    lastKind: kind,
    lastSenderId: senderId,
  };
  if (unreadFor.length) patch.unread = Object.fromEntries(unreadFor.map((u) => [u, increment(1)]));
  w.set(ref('conversations', conv.id), patch, { merge: true });
  return msg;
}

// draft — диалог, которого ещё нет в базе (см. supportDraft): он создаётся вместе с сообщением.
export async function sendMessage(conversationId, senderId, rawText, { draft = null } = {}) {
  const text = rawText.trim();
  if (!text) return null;
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Сообщение длиннее ${MAX_MESSAGE_LENGTH} символов`);
  const saved = db.conversations.peek(conversationId);
  const c = saved ?? (draft?.id === conversationId ? draft : null);
  if (!c) throw new Error('Диалог не найден');
  if (senderId !== c.parentId && senderId !== c.specialistId) throw new Error('Нет доступа к диалогу');
  const other = senderId === c.parentId ? c.specialistId : c.parentId;
  const w = batch();
  const adminId = supportAdminOf(c);
  if (!saved) ensureConversationRaw(w, c.parentId, c.specialistId, adminId ? { kind: SUPPORT, adminId } : null);
  const msg = pushMessageRaw(w, c, { senderId, text, unreadFor: [other] });
  // Пользователь может редко заходить в сообщения — о письме модератора напоминаем уведомлением,
  // но только о первом непрочитанном, а не о каждом.
  if (adminId && senderId === adminId && !c.unread?.[other]) {
    notifyRaw(w, other, {
      type: 'support_message',
      title: 'Сообщение от модератора Pingo',
      body: text.length > 140 ? `${text.slice(0, 139)}…` : text,
      link: `/${other === c.parentId ? 'parent' : 'specialist'}/messages/${c.id}`,
    });
  }
  await commit(w);
  return msg;
}

export async function markConversationRead(conversationId, userId) {
  const c = db.conversations.peek(conversationId);
  if (c?.unread?.[userId]) await update('conversations', conversationId, { [`unread.${userId}`]: 0 });
}
