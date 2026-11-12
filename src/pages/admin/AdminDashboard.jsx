import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellIcon,
  CertificateIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  GearIcon,
  HandHeartIcon,
  IdentificationCardIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  SignOutIcon,
  StarIcon,
  StorefrontIcon,
  UserIcon,
  UsersThreeIcon,
  VideoCameraIcon,
} from '@phosphor-icons/react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useNavCounts } from '../../hooks/useNavCounts';
import { useBookingTotals } from '../../hooks/useAdminStats';
import { db } from '../../lib/db';
import { DAY, addDays, cx, firstName, fmtAgo, fmtHours, fmtShortDate, plural, pluralize, startOfDay } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { averageRating, profileKind, ratingScore } from '../../services/admin';
import { kindLabel } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { MenuLink } from '../../components/MenuLink';
import { PageHeader } from '../../components/PageHeader';
import { ButtonLink, IconButton, Rating, SectionLabel, Stagger } from '../../components/ui';
import { t } from '../../i18n';

const WEEKS = 8;

// Понедельник недели, в которую попадает ts.
function weekStart(ts) {
  const d = startOfDay(ts);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// Новые пользователи по неделям: один ряд, поэтому без легенды — его называет заголовок.
// Подпись значения — только у последней недели, остальные — во всплывающей подсказке.
function WeeklyBars({ bins }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const last = bins.length - 1;
  const range = (b) => `${fmtShortDate(b.start)} – ${fmtShortDate(b.end - DAY)}`;
  return (
    <figure className="bars">
      <div className="bars__plot" onMouseLeave={() => setActive(null)}>
        {bins.map((b, i) => (
          <button
            key={b.start}
            type="button"
            className={cx('bars__col', active === i && 'is-active')}
            aria-label={`${range(b)}: ${pluralize(b.count, [t('новый пользователь'), t('новых пользователя'), t('новых пользователей')])}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            {i === last && active === null && <span className="bars__value">{b.count}</span>}
            <motion.span
              className="bars__bar"
              initial={{ height: 0 }}
              animate={{ height: `${(b.count / max) * 100}%` }}
              transition={{ type: 'spring', stiffness: 180, damping: 24, delay: i * 0.03 }}
            />
          </button>
        ))}
        {active !== null && (
          <div
            className={cx('bars__tip', active === 0 && 'bars__tip--start', active === last && 'bars__tip--end')}
            style={{ left: `${((active + (active === 0 ? 0 : active === last ? 1 : 0.5)) / bins.length) * 100}%` }}
            role="status"
          >
            <strong>{bins[active].count}</strong>
            <span>{range(bins[active])}</span>
          </div>
        )}
      </div>
      <div className="bars__axis" aria-hidden="true">
        {bins.map((b) => (
          <span key={b.start}>{fmtShortDate(b.start)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t('Новые пользователи по неделям')}</caption>
        <tbody>
          {bins.map((b) => (
            <tr key={b.start}>
              <th scope="row">{range(b)}</th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const fmtNum = (v) => (v == null ? '—' : v);

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const counts = useNavCounts(user);
  const totals = useBookingTotals();
  const data = useLiveQuery(async () => {
    const [users, profiles, reviews, complaints, certificates] = await Promise.all([
      db.users.toArray(),
      db.profiles.toArray(),
      db.reviews.toArray(),
      db.complaints.toArray(),
      db.certificates.toArray(),
    ]);
    return { users, profiles, reviews, complaints, certificates };
  }, []);

  if (!data) return <div className="page page--loading" />;

  const now = Date.now();
  const people = data.users.filter((u) => u.email && u.role !== 'admin');
  const profileOf = Object.fromEntries(data.profiles.map((p) => [p.id, p]));
  const specialists = people.filter((u) => u.role === 'specialist');
  const volunteers = specialists.filter((u) => profileKind(profileOf[u.id]) === 'volunteer');
  const peopleIds = new Set(people.map((u) => u.id));
  const published = data.profiles.filter((p) => p.published && peopleIds.has(p.id));
  const pending = data.profiles.filter((p) => p.status === 'pending').length;
  const waitingVerify = published.filter((p) => profileKind(p) === 'volunteer' && !p.verifiedAt).length;
  const openComplaints = data.complaints.filter((c) => c.status === 'open').length;
  const avg = averageRating(data.reviews);

  const bins = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(weekStart(now), (i - WEEKS + 1) * 7).getTime();
    return { start, end: addDays(start, 7).getTime(), count: 0 };
  });
  for (const u of people) {
    const bin = bins.find((b) => u.createdAt >= b.start && u.createdAt < b.end);
    if (bin) bin.count += 1;
  }
  const newInPeriod = bins.reduce((s, b) => s + b.count, 0);

  const usersById = Object.fromEntries(data.users.map((u) => [u.id, u]));
  const top = published
    .map((p) => {
      const reviews = data.reviews.filter((r) => r.specialistId === p.id);
      return { profile: p, user: usersById[p.id], score: ratingScore(reviews), avg: averageRating(reviews), count: reviews.length };
    })
    .filter((r) => r.user)
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 3);
  const recent = [...people].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const tasks = [
    pending > 0 && { icon: IdentificationCardIcon, title: t('{pluralize} проверки', { pluralize: pluralize(pending, [t('анкета ждёт'), t('анкеты ждут'), t('анкет ждут')]) }), text: t('Проверьте и опубликуйте в каталоге.'), to: '/admin/profiles', label: t('Проверить') },
    waitingVerify > 0 && { icon: HandHeartIcon, title: t('{pluralize} подтверждения', { pluralize: pluralize(waitingVerify, [t('волонтёр ждёт'), t('волонтёра ждут'), t('волонтёров ждут')]) }), text: t('Подтверждённые волонтёры получают отметку в каталоге.'), to: '/admin/volunteers', label: t('Открыть') },
    openComplaints > 0 && { icon: FlagIcon, title: `${pluralize(openComplaints, [t('открытая жалоба'), t('открытые жалобы'), t('открытых жалоб')])}`, text: t('Безопасность детей — в приоритете.'), to: '/admin/reports', label: t('Разобрать'), danger: true },
  ].filter(Boolean);

  const STATS = [
    { icon: UserIcon, value: people.filter((u) => u.role === 'parent').length, label: t('родителей'), to: '/admin/users?tab=parents' },
    { icon: UsersThreeIcon, value: specialists.length - volunteers.length, label: t('специалистов'), to: '/admin/users?tab=specialists' },
    { icon: HandHeartIcon, value: volunteers.length, label: t('волонтёров'), to: '/admin/volunteers' },
    { icon: StorefrontIcon, value: published.length, label: t('анкет в каталоге'), to: '/admin/profiles?tab=approved' },
    {
      icon: VideoCameraIcon,
      value: totals ? fmtNum(totals.done?.sessions) : '…',
      label: totals?.month ? t('занятий проведено · {sessions} за 30 дней', { sessions: totals.month.sessions }) : t('занятий проведено'),
    },
    { icon: ClockIcon, value: totals ? (totals.done ? fmtHours(totals.done.minutes) : '—') : '…', label: t('занятий с детьми') },
    {
      icon: StarIcon,
      value: avg ? avg.toFixed(1).replace('.', ',') : '—',
      label: data.reviews.length ? t('средняя оценка · {pluralize}', { pluralize: pluralize(data.reviews.length, [t('отзыв'), t('отзыва'), t('отзывов')]) }) : t('пока нет отзывов'),
      to: '/admin/rating',
    },
    { icon: CertificateIcon, value: data.certificates.length, label: plural(data.certificates.length, [t('сертификат выдан'), t('сертификата выдано'), t('сертификатов выдано')]), to: '/admin/rating' },
  ];

  const logout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="page admin-home">
      <PageHeader
        eyebrow={t('Админ-панель')}
        title={t('Обзор')}
        subtitle={t('Здравствуйте, {firstName}! Вот что происходит в Pingo.', { firstName: firstName(user.name) })}
        actions={!desktop && <IconButton icon={BellIcon} label={t('Уведомления')} to="/admin/notifications" badge={counts.notifications} size="lg" />}
      />

      {tasks.length ? (
        <div className="admin-tasks">
          {tasks.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.to} className={cx('callout', t.danger && 'callout--red')}>
                <Icon size={26} weight="fill" />
                <div>
                  <strong>{t.title}</strong>
                  <span>{t.text}</span>
                </div>
                <ButtonLink to={t.to} variant="dark" size="sm">
                  {t.label}
                </ButtonLink>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="callout callout--green">
          <CheckCircleIcon size={26} weight="fill" />
          <div>
            <strong>{t('Всё проверено')}</strong>
            <span>{t('Новых анкет, жалоб и волонтёров без подтверждения нет.')}</span>
          </div>
        </div>
      )}

      <Stagger className="stat-grid">
        {STATS.map((s) => {
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
                <Link to={s.to} className="stat-card">
                  {body}
                </Link>
              ) : (
                <div className="stat-card">{body}</div>
              )}
            </motion.div>
          );
        })}
      </Stagger>

      <div className="admin-home__grid">
        <section className="dark-card">
          <h2 className="dark-card__title">{t('Новые пользователи')}</h2>
          <p className="dark-card__foot">
            {pluralize(newInPeriod, [t('регистрация'), t('регистрации'), t('регистраций')])}{' '}{t('за {WEEKS} недель, по неделям', { WEEKS })}
          </p>
          <WeeklyBars bins={bins} />
        </section>

        <section className="card-section">
          <div className="card-section__head">
            <h2>{t('Лучшие по рейтингу')}</h2>
            <Link to="/admin/rating" className="link-more">
              {t('Весь рейтинг')}
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="muted">{t('В каталоге пока нет анкет.')}</p>
          ) : (
            <ol className="mini-rank">
              {top.map((r, i) => (
                <li key={r.profile.id}>
                  <Link to={`/admin/profiles/${r.profile.id}`} className="mini-rank__row">
                    <span className={`place place--${i + 1}`}>{i + 1}</span>
                    <Avatar avatar={r.user.avatar} name={r.user.name} size={40} />
                    <span className="mini-rank__who">
                      <strong>
                        {r.user.name}
                        {r.profile.verifiedAt && <SealCheckIcon size={16} weight="fill" className="ico-verified" aria-label={t('Подтверждён')} />}
                      </strong>
                      <span>{kindLabel(profileKind(r.profile))}</span>
                    </span>
                    <Rating rating={r.avg} count={r.count} />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <SectionLabel action={<Link to="/admin/users">{t('Все пользователи')}</Link>}>{t('Недавно зарегистрировались')}</SectionLabel>
      {recent.length === 0 ? (
        <p className="muted">{t('Пока никого нет.')}</p>
      ) : (
        <ul className="admin-list">
          {recent.map((u) => {
            const p = profileOf[u.id];
            const body = (
              <>
                <Avatar avatar={u.avatar} name={u.name} size={44} />
                <span className="admin-row__body">
                  <strong>{u.name}</strong>
                  <span className="admin-row__meta">
                    {u.role === 'parent' ? t('Родитель') : kindLabel(profileKind(p))} · {fmtAgo(u.createdAt, now)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={u.id}>
                {u.role === 'specialist' && p && p.status !== 'draft' ? (
                  <Link to={`/admin/profiles/${u.id}`} className="admin-row">
                    {body}
                  </Link>
                ) : (
                  <div className="admin-row admin-row--static">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!desktop && (
        <nav className="white-card menu menu--bordered">
          <MenuLink icon={UsersThreeIcon} to="/admin/users" hint={t('Поиск, экспорт в Excel')}>
            {t('Пользователи')}
          </MenuLink>
          <MenuLink icon={ShieldCheckIcon} to="/admin/moderators" hint={t('Добавить или убрать модератора')}>
            {t('Модераторы')}
          </MenuLink>
          <MenuLink icon={MegaphoneIcon} to="/admin/broadcast" hint={t('Сообщение родителям или волонтёрам')}>
            {t('Рассылки')}
          </MenuLink>
          <MenuLink icon={BellIcon} to="/admin/notifications" badge={counts.notifications}>
            {t('Уведомления')}
          </MenuLink>
          <MenuLink icon={GearIcon} to="/admin/settings">
            {t('Настройки')}
          </MenuLink>
          <MenuLink icon={LifebuoyIcon} to="/admin/help">
            {t('Помощь')}
          </MenuLink>
          <MenuLink icon={SignOutIcon} onClick={logout} danger>
            {t('Выйти')}
          </MenuLink>
        </nav>
      )}
    </div>
  );
}
