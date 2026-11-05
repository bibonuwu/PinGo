import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { motion } from 'framer-motion';
import {
  BellIcon,
  CalendarPlusIcon,
  CheckIcon,
  ClipboardTextIcon,
  ClockIcon,
  LightbulbIcon,
  StarIcon,
  TrayIcon,
  XIcon,
} from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { DAY, firstName, fmtDay, fmtHours, plural, toDateKey } from '../../lib/utils';
import { DECLINE_TEMPLATES } from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBookingsFor } from '../../hooks/useBookings';
import { useNavCounts } from '../../hooks/useNavCounts';
import { useNow } from '../../hooks/useNow';
import { confirmBooking, declineBooking, displayStatus } from '../../services/bookings';
import { profileIssues } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { BookingCard } from '../../components/BookingCard';
import { ModerationCard } from '../../components/ModerationCard';
import { Pingo } from '../../components/Pingo';
import { ReasonDialog } from '../../components/Sheet';
import { Button, ButtonLink, IconButton, SectionLabel, Stagger } from '../../components/ui';
import { t } from '../../i18n';

function greeting(now) {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 12) return t('Доброе утро');
  if (h >= 12 && h < 18) return t('Добрый день');
  if (h >= 18 && h < 23) return t('Добрый вечер');
  return t('Доброй ночи');
}

export default function SpecialistHome() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow(30_000);
  const profile = useLiveQuery(() => db.profiles.get(user.id), [user.id]);
  const rules = useLiveQuery(() => db.availability.where('specialistId').equals(user.id).toArray(), [user.id]);
  const reviews = useLiveQuery(() => db.reviews.where('specialistId').equals(user.id).toArray(), [user.id]);
  const bookings = useBookingsFor(user);
  const counts = useNavCounts(user);
  const [declineId, setDeclineId] = useState(null);

  const stats = useMemo(() => {
    if (!bookings) return null;
    const by = (s) => bookings.filter((b) => displayStatus(b, now) === s);
    const pending = by('pending').sort((a, b) => a.start - b.start);
    const upcoming = by('confirmed').sort((a, b) => a.start - b.start);
    const completed = by('completed');
    return {
      pending,
      upcoming,
      week: upcoming.filter((b) => b.start < now + 7 * DAY).length,
      completed: completed.length,
      minutes: completed.reduce((s, b) => s + b.duration, 0),
      needReport: completed.filter((b) => !b.report).sort((a, b) => b.start - a.start),
    };
  }, [bookings, now]);

  if (!profile || !rules || !reviews || !stats) return <div className="page page--loading" />;

  const rating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const isVolunteer = (profile.published ?? profile.draft).kind === 'volunteer';
  const futureRules = rules.filter((r) => r.type === 'weekly' || r.date >= toDateKey(now));

  const accept = async (id) => {
    try {
      await confirmBooking(user.id, id);
      toast.success(t('Занятие подтверждено — родитель получил уведомление'));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const STAT_CARDS = [
    { icon: TrayIcon, value: stats.pending.length, label: plural(stats.pending.length, [t('новый запрос'), t('новых запроса'), t('новых запросов')]), to: '/specialist/requests', tone: 'yellow' },
    { icon: CalendarPlusIcon, value: stats.week, label: t('{plural} на неделе', { plural: plural(stats.week, [t('занятие'), t('занятия'), t('занятий')]) }), to: '/specialist/requests?tab=upcoming' },
    isVolunteer
      ? { icon: ClockIcon, value: fmtHours(stats.minutes), label: t('часов волонтёрства') }
      : { icon: ClockIcon, value: stats.completed, label: plural(stats.completed, [t('занятие проведено'), t('занятия проведено'), t('занятий проведено')]) },
    { icon: StarIcon, value: rating ? rating.toFixed(1).replace('.', ',') : '—', label: rating ? t('рейтинг · {length} {plural}', { length: reviews.length, plural: plural(reviews.length, [t('отзыв'), t('отзыва'), t('отзывов')]) }) : t('пока нет отзывов') },
  ];

  return (
    <div className="page home">
      <header className="home__top">
        <Link to="/specialist/profile" className="home__child">
          <Avatar avatar={user.avatar} name={user.name} size={64} />
          <span>
            <span className="home__child-label">{isVolunteer ? t('Волонтёр') : t('Специалист')}</span>
            <strong>{user.name}</strong>
          </span>
        </Link>
        <IconButton icon={BellIcon} label={t('Уведомления')} to="/specialist/notifications" badge={counts.notifications} size="lg" />
      </header>

      <motion.h1 className="home__greeting" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {greeting(now)}, {firstName(user.name)}!{' '}
        {stats.pending.length > 0
          ? `${plural(stats.pending.length, [t('Вас ждёт'), t('Вас ждут'), t('Вас ждут')])} ${stats.pending.length} ${plural(stats.pending.length, [t('запрос'), t('запроса'), t('запросов')])}.`
          : t('Спасибо, что помогаете детям.')}
      </motion.h1>

      <ModerationCard profile={profile} issues={profileIssues(profile)} />

      <Stagger className="stat-grid">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          const body = (
            <>
              <Icon size={24} weight="fill" />
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </>
          );
          return (
            <motion.div key={s.label} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
              {s.to ? (
                <Link to={s.to} className={`stat-card ${s.tone === 'yellow' ? 'stat-card--yellow' : ''}`}>
                  {body}
                </Link>
              ) : (
                <div className="stat-card">{body}</div>
              )}
            </motion.div>
          );
        })}
      </Stagger>

      {futureRules.length === 0 && (
        <div className="callout">
          <CalendarPlusIcon size={26} weight="fill" />
          <div>
            <strong>{t('Добавьте расписание')}</strong>
            <span>{t('Без свободных окон родители не смогут записаться.')}</span>
          </div>
          <ButtonLink to="/specialist/availability" variant="dark" size="sm">
            {t('Настроить')}
          </ButtonLink>
        </div>
      )}

      {stats.needReport.length > 0 && (
        <div className="callout callout--blue">
          <ClipboardTextIcon size={26} weight="fill" />
          <div>
            <strong>{t('Заполните отчёт')}</strong>
            <span>
              {t('Занятие:')}{' '}{stats.needReport[0].child?.name ?? t('ребёнок')} · {fmtDay(stats.needReport[0].start, now).toLowerCase()}
            </span>
          </div>
          <ButtonLink to={`/specialist/requests/${stats.needReport[0].id}`} variant="dark" size="sm">
            {t('Заполнить')}
          </ButtonLink>
        </div>
      )}

      {stats.pending.length > 0 && (
        <>
          <SectionLabel action={<Link to="/specialist/requests">{t('Все')}</Link>}>{t('Новые запросы')}</SectionLabel>
          <Stagger className="list">
            {stats.pending.slice(0, 3).map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                viewer="specialist"
                counterpart={b.parent}
                child={b.child}
                now={now}
                to={`/specialist/requests/${b.id}`}
                actions={
                  <>
                    <Button size="sm" variant="primary" icon={CheckIcon} onClick={() => accept(b.id)}>
                      {t('Принять')}
                    </Button>
                    <Button size="sm" variant="soft" icon={XIcon} onClick={() => setDeclineId(b.id)}>
                      {t('Отклонить')}
                    </Button>
                  </>
                }
              />
            ))}
          </Stagger>
        </>
      )}

      <SectionLabel action={<Link to="/specialist/requests?tab=upcoming">{t('Расписание')}</Link>}>{t('Ближайшие занятия')}</SectionLabel>
      {stats.upcoming.length ? (
        <Stagger className="list">
          {stats.upcoming.slice(0, 3).map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              viewer="specialist"
              counterpart={b.parent}
              child={b.child}
              now={now}
              to={`/specialist/requests/${b.id}`}
            />
          ))}
        </Stagger>
      ) : (
        <p className="muted">{t('Подтверждённых занятий пока нет.')}</p>
      )}

      <div className="tip">
        <Pingo size={64} mood="wink" outfit="scarf" />
        <div>
          <strong>
            <LightbulbIcon size={18} weight="fill" />{' '}{t('Совет от Pingo')}
          </strong>
          <p>{t('Посмотрите профиль ребёнка перед занятием: особенности, цели и настройки интерфейса подскажут, как начать.')}</p>
        </div>
      </div>

      <ReasonDialog
        open={!!declineId}
        onClose={() => setDeclineId(null)}
        title={t('Отклонить запрос')}
        text={t('Родитель увидит причину и сможет выбрать другое время.')}
        templates={DECLINE_TEMPLATES}
        confirmLabel={t('Отклонить')}
        onConfirm={(reason) => declineBooking(user.id, declineId, reason).then(() => toast.info(t('Запрос отклонён')))}
      />
    </div>
  );
}
