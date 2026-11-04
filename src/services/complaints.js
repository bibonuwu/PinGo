import { db } from '../lib/db';
import { COMPLAINT_REASON_MAP } from '../lib/constants';
import { uid } from '../lib/utils';
import { notifyAdminsRaw } from './notifications';

// Жалобы на пользователей (концепция, раздел «Безопасность»). Их разбирает администратор.
export async function createComplaint({ reporterId, targetId, reason, details = '', context = null }) {
  if (!COMPLAINT_REASON_MAP[reason]) throw new Error('Выберите причину жалобы');
  if (reason === 'other' && details.trim().length < 10) throw new Error('Опишите проблему — минимум 10 символов');
  const [reporter, target] = await Promise.all([db.users.get(reporterId), db.users.get(targetId)]);
  if (!target) throw new Error('Пользователь не найден');
  const complaint = {
    id: uid(),
    reporterId,
    targetId,
    reason,
    details: details.trim().slice(0, 1000),
    context,
    status: 'open',
    resolution: null,
    createdAt: Date.now(),
    resolvedAt: null,
  };
  await db.transaction('rw', db.complaints, db.users, db.notifications, async () => {
    await db.complaints.add(complaint);
    await notifyAdminsRaw({
      type: 'complaint',
      title: 'Новая жалоба',
      body: `${reporter?.name ?? 'Пользователь'} → ${target.name}: ${COMPLAINT_REASON_MAP[reason].label}`,
      link: '/admin/reports',
    });
  });
  return complaint;
}

export async function resolveComplaint(id, adminId, resolution = '') {
  await db.complaints.update(id, {
    status: 'resolved',
    resolution: resolution.trim() || 'Проверено',
    resolvedBy: adminId,
    resolvedAt: Date.now(),
  });
}
