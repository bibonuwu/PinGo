import { increment } from 'firebase/firestore';
import { db } from '../lib/db';
import { batch, commit, ref, update } from '../lib/remote';
import { uid } from '../lib/utils';

export const MAX_MESSAGE_LENGTH = 2000;

export const conversationIdFor = (parentId, specialistId) => `c_${parentId}_${specialistId}`;

// Добавляет в пакет создание диалога, если его ещё нет. Возвращает { id, parentId, specialistId }.
export function ensureConversationRaw(w, parentId, specialistId) {
  const id = conversationIdFor(parentId, specialistId);
  if (!db.conversations.peek(id)) {
    const now = Date.now();
    w.set(
      ref('conversations', id),
      { id, parentId, specialistId, createdAt: now, updatedAt: now, lastText: '', lastSenderId: null },
      { merge: true },
    );
  }
  return { id, parentId, specialistId };
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

export async function sendMessage(conversationId, senderId, rawText) {
  const text = rawText.trim();
  if (!text) return null;
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Сообщение длиннее ${MAX_MESSAGE_LENGTH} символов`);
  const c = db.conversations.peek(conversationId);
  if (!c) throw new Error('Диалог не найден');
  if (senderId !== c.parentId && senderId !== c.specialistId) throw new Error('Нет доступа к диалогу');
  const other = senderId === c.parentId ? c.specialistId : c.parentId;
  const w = batch();
  const msg = pushMessageRaw(w, c, { senderId, text, unreadFor: [other] });
  await commit(w);
  return msg;
}

export async function markConversationRead(conversationId, userId) {
  const c = db.conversations.peek(conversationId);
  if (c?.unread?.[userId]) await update('conversations', conversationId, { [`unread.${userId}`]: 0 });
}
