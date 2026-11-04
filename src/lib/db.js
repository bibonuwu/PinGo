import Dexie from 'dexie';

// Локальная база данных (IndexedDB). Все обращения к ней идут через src/services,
// поэтому позже её можно заменить на сервер (например, Firebase), не трогая страницы.
export const db = new Dexie('pingo');

db.version(1).stores({
  users: 'id, &email, role',
  children: 'id, parentId',
  profiles: 'id, status', // id = id пользователя-специалиста
  availability: 'id, specialistId',
  bookings: 'id, parentId, specialistId, childId, status, start',
  reviews: 'id, specialistId, bookingId, createdAt',
  conversations: 'id, parentId, specialistId, updatedAt',
  messages: 'id, conversationId, [conversationId+createdAt]',
  notifications: 'id, userId, createdAt',
  complaints: 'id, status, targetId, createdAt',
  files: 'id, ownerId',
  meta: 'key',
});
