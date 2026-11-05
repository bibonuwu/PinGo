import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  BellIcon,
  BookOpenIcon,
  CalendarCheckIcon,
  HandGrabbingIcon,
  HandHeartIcon,
  HeartIcon,
  LightbulbIcon,
  MicrophoneIcon,
  SparkleIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { entryCategories, freshSlots, useCatalog } from '../../hooks/useCatalog';
import { useBookingsFor, useChildren } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { useNavCounts } from '../../hooks/useNavCounts';
import { CATEGORIES } from '../../lib/constants';
import { matchChild } from '../../lib/matching';
import { capitalize, firstName, fmtDateYear, fmtWeekdayLong, isSameDay, plural } from '../../lib/utils';
import { displayStatus, isUpcoming } from '../../services/bookings';
import { setActiveChild } from '../../services/children';
import { Avatar } from '../../components/Avatar';
import { BookingCard } from '../../components/BookingCard';
import { ChildSwitcher } from '../../components/ChildSwitcher';
import { Pingo } from '../../components/Pingo';
import { SpecialistCard } from '../../components/SpecialistCard';
import { ButtonLink, IconButton, ProgressRing, SectionLabel, Stagger } from '../../components/ui';
import { toggleFavorite } from '../../services/auth';
import { t } from '../../i18n';

const CATEGORY_ICONS = {
  speech: MicrophoneIcon,
  tutoring: BookOpenIcon,
  psychology: HeartIcon,
  ot: HandGrabbingIcon,
  volunteers: HandHeartIcon,
};

const TIPS = [
  t('Перед занятием расскажите ребёнку, что будет: кто придёт и чем займётесь. Предсказуемость снижает тревогу.'),
  t('Короткие занятия по 10–15 минут каждый день работают лучше, чем одно длинное в неделю.'),
  t('Хвалите за усилия, а не только за результат: «Ты так старался!»'),
  t('Записывайте маленькие победы — через месяц будет видно, какой путь пройден.'),
  t('Визуальное расписание дня помогает детям с РАС и СДВГ чувствовать себя спокойнее.'),
];

function nextStep({ children, bookings, activeChild, now }) {
  if (!children.length) {
    return {
      title: t('Создайте профиль ребёнка'),
      text: t('Pingo-гид поможет за пару минут — и я начну подбирать специалистов по возрасту и потребностям.'),
      to: '/parent/children/new',
      label: t('Создать профиль'),
    };
  }
  const needsReview = bookings.find((b) => displayStatus(b, now) === 'completed' && !b.reviewId);
  if (needsReview) {
    return {
      title: t('Как прошло занятие?'),
      text: t('Специалист: {p0}. Ваш отзыв поможет другим семьям выбрать.', { p0: needsReview.specialist?.name ?? '—' }),
      to: `/parent/bookings/${needsReview.id}`,
      label: t('Оставить отзыв'),
    };
  }
  if (bookings.some((b) => b.status === 'pending' && isUpcoming(b, now))) {
    return {
      title: t('Ждём подтверждения'),
      text: t('Специалист скоро ответит на запрос. Я пришлю уведомление, как только статус изменится.'),
      to: '/parent/bookings',
      label: t('Мои записи'),
    };
  }
  if (!bookings.some((b) => isUpcoming(b, now))) {
    return {
      title: t('Готовы к первому занятию?'),
      text: t('Профиль «{p0}» готов. Выберите специалиста или волонтёра и удобное время — первое занятие можно провести уже на этой неделе.', { p0: activeChild?.name ?? t('ребёнка') }),
      to: '/parent/specialists',
      label: t('Найти специалиста'),
    };
  }
  return {
    title: t('Всё идёт по плану'),
    text: t('Регулярность — главный секрет прогресса. Запланируйте следующее занятие заранее.'),
    to: '/parent/specialists',
    label: t('Выбрать время'),
  };
}

export default function ParentHome() {
  const { user } = useAuth();
  const now = useNow(30_000);
  const children = useChildren(user.id);
  const catalog = useCatalog();
  const bookings = useBookingsFor(user);
  const counts = useNavCounts(user);

  const activeChild = children?.find((c) => c.id === user.activeChildId) ?? children?.[0];

  const stats = useMemo(() => {
    if (!catalog) return null;
    const byCat = CATEGORIES.map((c) => ({ ...c, count: catalog.filter((e) => entryCategories(e).has(c.id)).length }));
    const freeToday = catalog.filter((e) => freshSlots(e.slots, now).some((s) => isSameDay(s.start, now))).length;
    return { byCat, total: catalog.length, freeToday };
  }, [catalog, now]);

  const recommended = useMemo(() => {
    if (!catalog || !activeChild) return [];
    return catalog
      .map((e) => ({ e, m: matchChild(activeChild, e.data) }))
      .filter(({ m }) => m.good)
      .sort((a, b) => b.m.score - a.m.score || (b.e.rating ?? 0) - (a.e.rating ?? 0))
      .slice(0, 4);
  }, [catalog, activeChild]);

  if (!children || !catalog || !bookings || !stats) return <div className="page page--loading" />;

  const upcoming = bookings.filter((b) => isUpcoming(b, now)).sort((a, b) => a.start - b.start);
  const step = nextStep({ children, bookings, activeChild, now });
  const tip = TIPS[Math.floor(now / 86_400_000) % TIPS.length];
  const totalCat = stats.byCat.reduce((s, c) => s + c.count, 0) || 1;
  const topCats = [...stats.byCat].sort((a, b) => b.count - a.count).slice(0, 4);
  const favorites = new Set(user.favorites ?? []);

  return (
    <div className="page home">
      <header className="home__top">
        {activeChild ? (
          <Link to={`/parent/children/${activeChild.id}`} className="home__child">
            <Avatar avatar={activeChild.avatar} name={activeChild.name} size={64} />
            <span>
              <span className="home__child-label">{t('Профиль ребёнка')}</span>
              <strong>{activeChild.name}</strong>
            </span>
          </Link>
        ) : (
          <Link to="/parent/children/new" className="home__child">
            <Avatar name={user.name} size={64} />
            <span>
              <span className="home__child-label">{t('Профиль ребёнка')}</span>
              <strong>{t('Добавить')}</strong>
            </span>
          </Link>
        )}
        <IconButton icon={BellIcon} label={t('Уведомления')} to="/parent/notifications" badge={counts.notifications} size="lg" />
      </header>

      <p className="home__date">
        {capitalize(fmtWeekdayLong(now))}, {fmtDateYear(now)}
      </p>
      <motion.h1 className="home__greeting" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {t('Привет, {firstName}! Какая поддержка нужна сегодня?', { firstName: firstName(user.name) })}{' '}
        <span className="home__pingo" aria-hidden="true">
          <Pingo size={44} mood="happy" />
        </span>
      </motion.h1>

      <div className="cat-pills" role="list">
        {CATEGORIES.map((c, i) => {
          const Icon = CATEGORY_ICONS[c.id];
          return (
            <motion.div
              key={c.id}
              role="listitem"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, type: 'spring', stiffness: 300, damping: 24 }}
            >
              <Link to={`/parent/specialists?cat=${c.id}`} className="cat-pill">
                <span className="cat-pill__icon" style={{ background: c.color }}>
                  <Icon size={26} weight="bold" />
                </span>
                <span className="cat-pill__label">{c.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <SectionLabel>{t('Кто занимается сегодня?')}</SectionLabel>
      <ChildSwitcher
        items={children}
        activeId={activeChild?.id}
        onSelect={(id) => setActiveChild(user.id, id)}
        addTo="/parent/children/new"
      />

      <div className="home__grid">
        <motion.div className="dark-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="dark-card__title">
            <SquaresFourIcon size={24} weight="bold" className="ico-yellow" />{' '}{t('По направлениям')}
          </h3>
          <div className="stack-bar" aria-hidden="true">
            {stats.byCat.map(
              (c) =>
                c.count > 0 && (
                  <motion.span
                    key={c.id}
                    style={{ background: c.color }}
                    initial={{ flexGrow: 0 }}
                    animate={{ flexGrow: c.count / totalCat }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  />
                ),
            )}
          </div>
          <ul className="legend">
            {topCats.map((c) => (
              <li key={c.id}>
                <span className="legend__dot" style={{ background: c.color }} />
                <span>{c.label}</span>
                <strong>{c.count}</strong>
              </li>
            ))}
          </ul>
          <p className="dark-card__foot">
            {stats.total} {plural(stats.total, [t('анкета'), t('анкеты'), t('анкет')])}{' '}{t('в каталоге')}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Link to="/parent/specialists?today=1" className="dark-card dark-card--link">
            <h3 className="dark-card__title">
              <CalendarCheckIcon size={24} weight="bold" className="ico-green" />{' '}{t('Свободно сегодня')}
            </h3>
            <div className="today">
              <ProgressRing value={stats.total ? stats.freeToday / stats.total : 0} size={112} stroke={11}>
                <strong>{stats.total ? Math.round((stats.freeToday / stats.total) * 100) : 0}%</strong>
              </ProgressRing>
              <div className="today__text">
                <strong>{stats.freeToday}</strong>
                <span>
                  {plural(stats.freeToday, [t('свободен'), t('свободны'), t('свободны')])}{' '}{t('· {total} всего', { total: stats.total })}
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>

      {upcoming.length > 0 && (
        <>
          <SectionLabel action={<Link to="/parent/bookings">{t('Все записи')}</Link>}>{t('Ближайшие занятия')}</SectionLabel>
          <Stagger className="list">
            {upcoming.slice(0, 2).map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                viewer="parent"
                counterpart={b.specialist}
                child={b.child}
                now={now}
                to={`/parent/bookings/${b.id}`}
              />
            ))}
          </Stagger>
        </>
      )}

      <motion.div className="next-step" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="next-step__top">
          <span className="next-step__badge">
            <SparkleIcon size={16} weight="fill" />{' '}{t('Следующий шаг')}
          </span>
          <span className="next-step__meta">{children.length ? t('Профиль готов') : t('Начало')}</span>
        </div>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        <ButtonLink to={step.to} variant="dark" iconRight={ArrowRightIcon}>
          {step.label}
        </ButtonLink>
      </motion.div>

      {recommended.length > 0 && (
        <>
          <SectionLabel action={<Link to="/parent/specialists?match=1">{t('Все')}</Link>}>
            {t('Рекомендации · {name}', { name: activeChild.name })}
          </SectionLabel>
          <Stagger className="sp-grid">
            {recommended.map(({ e, m }) => (
              <SpecialistCard
                key={e.id}
                entry={e}
                match={m}
                childName={activeChild.name}
                now={now}
                to={`/parent/specialists/${e.id}`}
                favorite={favorites.has(e.id)}
                onToggleFavorite={() => toggleFavorite(user.id, e.id)}
              />
            ))}
          </Stagger>
        </>
      )}

      <div className="tip">
        <Pingo size={64} mood="wink" />
        <div>
          <strong>
            <LightbulbIcon size={18} weight="fill" />{' '}{t('Совет от Pingo')}
          </strong>
          <p>{tip}</p>
        </div>
      </div>
    </div>
  );
}
