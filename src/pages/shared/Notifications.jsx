import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { motion } from 'framer-motion';
import {
  BellIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  CertificateIcon,
  ChecksIcon,
  ClipboardTextIcon,
  FlagIcon,
  IdentificationCardIcon,
  MegaphoneIcon,
  SealCheckIcon,
  StarIcon,
  TrayIcon,
  VideoCameraIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { DAY, cx, fmtAgo, startOfDay } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { markAllNotificationsRead, markNotificationRead } from '../../services/notifications';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui';

const ICONS = {
  booking_request: TrayIcon,
  booking_confirmed: CalendarCheckIcon,
  booking_declined: CalendarXIcon,
  booking_cancelled: CalendarXIcon,
  report_added: ClipboardTextIcon,
  review_added: StarIcon,
  room_open: VideoCameraIcon,
  profile_submitted: IdentificationCardIcon,
  profile_approved: SealCheckIcon,
  profile_rejected: WarningCircleIcon,
  profile_revoked: WarningCircleIcon,
  profile_verified: SealCheckIcon,
  profile_unverified: WarningCircleIcon,
  certificate_issued: CertificateIcon,
  announcement: MegaphoneIcon,
  complaint: FlagIcon,
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const list = useLiveQuery(
    async () => (await db.notifications.where('userId').equals(user.id).toArray()).sort((a, b) => b.createdAt - a.createdAt),
    [user.id],
  );

  if (!list) return <div className="page page--loading" />;
  const unread = list.filter((n) => !n.read).length;
  const today = startOfDay(Date.now()).getTime();
  const groups = [
    { title: 'Сегодня', items: list.filter((n) => n.createdAt >= today) },
    { title: 'Вчера', items: list.filter((n) => n.createdAt < today && n.createdAt >= today - DAY) },
    { title: 'Ранее', items: list.filter((n) => n.createdAt < today - DAY) },
  ].filter((g) => g.items.length);

  const open = async (n) => {
    if (!n.read) await markNotificationRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="page">
      <PageHeader
        back={`/${user.role}`}
        title="Уведомления"
        actions={
          unread > 0 && (
            <Button variant="soft" size="sm" icon={ChecksIcon} onClick={() => markAllNotificationsRead(user.id)}>
              Прочитать все
            </Button>
          )
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={BellIcon} title="Пока тихо" text="Здесь появятся новости о записях, сообщениях и анкете." />
      ) : (
        groups.map((g) => (
          <section key={g.title} className="notif-group">
            <h2 className="section-label">
              <span>{g.title}</span>
            </h2>
            <ul className="notif-list">
              {g.items.map((n, i) => {
                const Icon = ICONS[n.type] ?? BellIcon;
                return (
                  <motion.li key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                    <button type="button" className={cx('notif', !n.read && 'is-unread')} onClick={() => open(n)}>
                      <span className={`notif__icon notif__icon--${n.type}`}>
                        <Icon size={22} weight="fill" />
                      </span>
                      <span className="notif__body">
                        <strong>{n.title}</strong>
                        {n.body && <span>{n.body}</span>}
                        <time>{fmtAgo(n.createdAt)}</time>
                      </span>
                      {!n.read && <span className="notif__dot" aria-label="Не прочитано" />}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
