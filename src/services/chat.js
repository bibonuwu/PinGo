import { db } from '../lib/db';
import { uid } from '../lib/utils';

export const MAX_MESSAGE_LENGTH = 2000;

export const conversationIdFor = (parentId, specialistId) => `c_${parentId}_${specialistId}`;

export async function ensureConversationRaw(parentId, specialistId) {
  const id = conversationIdFor(parentId, specialistId);
  const existing = await db.conversations.get(id);
  if (!existing) {
    const now = Date.now();
    await db.conversations.add({
      id,
      parentId,
      specialistId,
      createdAt: now,
      updatedAt: now,
      lastText: '',
      lastSenderId: null,
      unread: { [parentId]: 0, [specialistId]: 0 },
    });
  }
  return id;
}

export function ensureConversation(parentId, specialistId) {
  return db.transaction('rw', db.conversations, () => ensureConversationRaw(parentId, specialistId));
}

// kind: 'text' | 'system'. unreadFor — кому увеличить счётчик непрочитанного.
export async function pushMessageRaw(
  conversationId,
  { senderId, text, kind = 'text', bookingId = null, unreadFor = [], createdAt = Date.now() },
) {
  const msg = { id: uid(), conversationId, senderId, text, kind, bookingId, createdAt };
  await db.messages.add(msg);
  const c = await db.conversations.get(conversationId);
  if (c) {
    const unread = { ...(c.unread || {}) };
    for (const u of unreadFor) unread[u] = (unread[u] || 0) + 1;
    await db.conversations.update(conversationId, {
      updatedAt: Math.max(c.updatedAt || 0, createdAt),
      lastText: text,
      lastKind: kind,
      lastSenderId: senderId,
      unread,
    });
  }
  return msg;
}

export async function sendMessage(conversationId, senderId, rawText) {
  const text = rawText.trim();
  if (!text) return null;
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Сообщение длиннее ${MAX_MESSAGE_LENGTH} символов`);
  return db.transaction('rw', db.conversations, db.messages, async () => {
    const c = await db.conversations.get(conversationId);
    if (!c) throw new Error('Диалог не найден');
    if (senderId !== c.parentId && senderId !== c.specialistId) throw new Error('Нет доступа к диалогу');
    const other = senderId === c.parentId ? c.specialistId : c.parentId;
    return pushMessageRaw(conversationId, { senderId, text, unreadFor: [other] });
  });
}

export async function markConversationRead(conversationId, userId) {
  const c = await db.conversations.get(conversationId);
  if (c?.unread?.[userId]) {
    await db.conversations.update(conversationId, { unread: { ...c.unread, [userId]: 0 } });
  }
}
