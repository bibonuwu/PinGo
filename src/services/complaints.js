import { db } from '../lib/db';
import { batch, commit, ref, update } from '../lib/remote';
import { COMPLAINT_REASON_MAP } from '../lib/constants';
import { uid } from '../lib/utils';
import { notifyAdminsRaw } from './notifications';
import { msg } from '../i18n/stored';
import { t } from '../i18n';

// Жалобы на пользователей (концепция, раздел «Безопасность»). Их разбирает администратор.
export async function createComplaint({ reporterId, targetId, reason, details = '', context = null }) {
  if (!COMPLAINT_REASON_MAP[reason]) throw new Error(t('Выберите причину жалобы'));
  if (reason === 'other' && details.trim().length < 10) throw new Error(t('Опишите проблему — минимум 10 символов'));
  const [reporter, target] = await Promise.all([db.users.get(reporterId), db.users.get(targetId)]);
  if (!target) throw new Error(t('Пользователь не найден'));
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
  const w = batch();
  w.set(ref('complaints', complaint.id), complaint);
  await notifyAdminsRaw(w, {
    type: 'complaint',
    title: msg('Новая жалоба'),
    body: msg('{reporter} → {target}: {reason}', {
      reporter: reporter?.name ?? { t: 'Пользователь' },
      target: target.name,
      reason: { label: 'complaintReason', id: reason },
    }),
    link: '/admin/reports',
  });
  await commit(w);
  return complaint;
}

export async function resolveComplaint(id, adminId, resolution = '') {
  await update('complaints', id, {
    status: 'resolved',
    resolution: resolution.trim() || t('Проверено'),
    resolvedBy: adminId,
    resolvedAt: Date.now(),
  });
}
