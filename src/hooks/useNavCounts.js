import { useLiveQuery } from './useLiveQuery';
import { db } from '../lib/db';

// Счётчики для навигации: непрочитанные сообщения, новые запросы, уведомления, анкеты на модерации,
// волонтёры без подтверждения.
export function useNavCounts(user) {
  return (
    useLiveQuery(async () => {
      if (!user) return {};
      const notifications = (await db.notifications.where('userId').equals(user.id).toArray()).filter(
        (n) => !n.read,
      ).length;
      if (user.role === 'admin') {
        const [profiles, reports, published, asSpecialist, asParent] = await Promise.all([
          db.profiles.where('status').equals('pending').count(),
          db.complaints.where('status').equals('open').count(),
          db.profiles.toArray().then((list) => list.filter((p) => p.published?.kind === 'volunteer' && !p.verifiedAt)),
          // Диалоги поддержки: модератор в них на месте специалиста или родителя.
          db.conversations.where('specialistId').equals(user.id).toArray(),
          db.conversations.where('parentId').equals(user.id).toArray(),
        ]);
        const owners = await db.users.bulkGet(published.map((p) => p.id));
        const volunteers = owners.filter((u) => u?.role === 'specialist').length;
        const messages = [...asSpecialist, ...asParent].reduce((s, c) => s + (c.unread?.[user.id] || 0), 0);
        return { profiles, reports, volunteers, messages, notifications };
      }
      const field = user.role === 'parent' ? 'parentId' : 'specialistId';
      const convs = await db.conversations.where(field).equals(user.id).toArray();
      const messages = convs.reduce((s, c) => s + (c.unread?.[user.id] || 0), 0);
      let requests = 0;
      if (user.role === 'specialist') {
        const now = Date.now();
        requests = (await db.bookings.where('specialistId').equals(user.id).toArray()).filter(
          (b) => b.status === 'pending' && b.start > now,
        ).length;
      }
      return { messages, requests, notifications };
    }, [user?.id, user?.role]) ?? {}
  );
}
