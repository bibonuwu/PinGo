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
            aria-label={`${range(b)}: ${pluralize(b.count, ['новый пользователь', 'новых пользователя', 'новых пользователей'])}`}
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
        <caption>Новые пользователи по неделям</caption>
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
    pending > 0 && { icon: IdentificationCardIcon, title: `${pluralize(pending, ['анкета ждёт', 'анкеты ждут', 'анкет ждут'])} проверки`, text: 'Проверьте и опубликуйте в каталоге.', to: '/admin/profiles', label: 'Проверить' },
    waitingVerify > 0 && { icon: HandHeartIcon, title: `${pluralize(waitingVerify, ['волонтёр ждёт', 'волонтёра ждут', 'волонтёров ждут'])} подтверждения`, text: 'Подтверждённые волонтёры получают отметку в каталоге.', to: '/admin/volunteers', label: 'Открыть' },
    openComplaints > 0 && { icon: FlagIcon, title: `${pluralize(openComplaints, ['открытая жалоба', 'открытые жалобы', 'открытых жалоб'])}`, text: 'Безопасность детей — в приоритете.', to: '/admin/reports', label: 'Разобрать', danger: true },
  ].filter(Boolean);

  const STATS = [
    { icon: UserIcon, value: people.filter((u) => u.role === 'parent').length, label: 'родителей', to: '/admin/users?tab=parents' },
    { icon: UsersThreeIcon, value: specialists.length - volunteers.length, label: 'специалистов', to: '/admin/users?tab=specialists' },
    { icon: HandHeartIcon, value: volunteers.length, label: 'волонтёров', to: '/admin/volunteers' },
    { icon: StorefrontIcon, value: published.length, label: 'анкет в каталоге', to: '/admin/profiles?tab=approved' },
    {
      icon: VideoCameraIcon,
      value: totals ? fmtNum(totals.done?.sessions) : '…',
      label: totals?.month ? `занятий проведено · ${totals.month.sessions} за 30 дней` : 'занятий проведено',
    },
    { icon: ClockIcon, value: totals ? (totals.done ? fmtHours(totals.done.minutes) : '—') : '…', label: 'занятий с детьми' },
    {
      icon: StarIcon,
      value: avg ? avg.toFixed(1).replace('.', ',') : '—',
      label: data.reviews.length ? `средняя оценка · ${pluralize(data.reviews.length, ['отзыв', 'отзыва', 'отзывов'])}` : 'пока нет отзывов',
      to: '/admin/rating',
    },
    { icon: CertificateIcon, value: data.certificates.length, label: plural(data.certificates.length, ['сертификат выдан', 'сертификата выдано', 'сертификатов выдано']), to: '/admin/rating' },
  ];

  const logout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="page admin-home">
      <PageHeader
        eyebrow="Админ-панель"
        title="Обзор"
        subtitle={`Здравствуйте, ${firstName(user.name)}! Вот что происходит в Pingo.`}
        actions={!desktop && <IconButton icon={BellIcon} label="Уведомления" to="/admin/notifications" badge={counts.notifications} size="lg" />}
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
            <strong>Всё проверено</strong>
            <span>Новых анкет, жалоб и волонтёров без подтверждения нет.</span>
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
          <h2 className="dark-card__title">Новые пользователи</h2>
          <p className="dark-card__foot">
            {pluralize(newInPeriod, ['регистрация', 'регистрации', 'регистраций'])} за {WEEKS} недель, по неделям
          </p>
          <WeeklyBars bins={bins} />
        </section>

        <section className="card-section">
          <div className="card-section__head">
            <h2>Лучшие по рейтингу</h2>
            <Link to="/admin/rating" className="link-more">
              Весь рейтинг
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="muted">В каталоге пока нет анкет.</p>
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
                        {r.profile.verifiedAt && <SealCheckIcon size={16} weight="fill" className="ico-verified" aria-label="Подтверждён" />}
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

      <SectionLabel action={<Link to="/admin/users">Все пользователи</Link>}>Недавно зарегистрировались</SectionLabel>
      {recent.length === 0 ? (
        <p className="muted">Пока никого нет.</p>
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
                    {u.role === 'parent' ? 'Родитель' : kindLabel(profileKind(p))} · {fmtAgo(u.createdAt, now)}
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
          <MenuLink icon={UsersThreeIcon} to="/admin/users" hint="Поиск, экспорт в Excel">
            Пользователи
          </MenuLink>
          <MenuLink icon={MegaphoneIcon} to="/admin/broadcast" hint="Сообщение родителям или волонтёрам">
            Рассылки
          </MenuLink>
          <MenuLink icon={BellIcon} to="/admin/notifications" badge={counts.notifications}>
            Уведомления
          </MenuLink>
          <MenuLink icon={GearIcon} to="/admin/settings">
            Настройки
          </MenuLink>
          <MenuLink icon={LifebuoyIcon} to="/admin/help">
            Помощь
          </MenuLink>
          <MenuLink icon={SignOutIcon} onClick={logout} danger>
            Выйти
          </MenuLink>
        </nav>
      )}
    </div>
  );
}
