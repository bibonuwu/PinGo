import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellIcon,
  CalendarDotsIcon,
  ChatCircleDotsIcon,
  FlagIcon,
  GearIcon,
  HandHeartIcon,
  HouseIcon,
  IdentificationCardIcon,
  RankingIcon,
  SignOutIcon,
  SquaresFourIcon,
  TrayIcon,
  UserIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { cx } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useNavCounts } from '../hooks/useNavCounts';
import { Avatar } from '../components/Avatar';
import { InstallCard } from '../components/InstallCard';
import { Tour } from '../components/Tour';
import { AnimatedOutlet } from './AnimatedOutlet';
import { t } from '../i18n';

export const NAV = {
  parent: [
    { to: '/parent', end: true, label: t('Главная'), icon: HouseIcon },
    { to: '/parent/specialists', label: t('Специалисты'), icon: UsersThreeIcon },
    { to: '/parent/bookings', label: t('Записи'), icon: CalendarDotsIcon },
    { to: '/parent/messages', label: t('Сообщения'), icon: ChatCircleDotsIcon, badge: 'messages' },
    { to: '/parent/profile', label: t('Профиль'), icon: UserIcon, also: ['/parent/children', '/parent/settings', '/parent/help'] },
  ],
  specialist: [
    { to: '/specialist', end: true, label: t('Главная'), icon: HouseIcon },
    { to: '/specialist/availability', label: t('Расписание'), icon: CalendarDotsIcon },
    { to: '/specialist/requests', label: t('Запросы'), icon: TrayIcon, badge: 'requests' },
    { to: '/specialist/messages', label: t('Сообщения'), icon: ChatCircleDotsIcon, badge: 'messages' },
    {
      to: '/specialist/profile',
      label: t('Профиль'),
      icon: UserIcon,
      also: ['/specialist/training', '/specialist/settings', '/specialist/help'],
    },
  ],
  // На телефоне «Пользователи», «Рассылки», уведомления и настройки открываются из «Обзора» (mobileAlso),
  // на компьютере уведомления и настройки — внизу боковой панели.
  admin: [
    {
      to: '/admin',
      end: true,
      label: t('Обзор'),
      icon: SquaresFourIcon,
      mobileAlso: ['/admin/users', '/admin/broadcast', '/admin/notifications', '/admin/settings', '/admin/help'],
    },
    { to: '/admin/profiles', label: t('Анкеты'), icon: IdentificationCardIcon, badge: 'profiles' },
    { to: '/admin/rating', label: t('Рейтинг'), icon: RankingIcon },
    { to: '/admin/volunteers', label: t('Волонтёры'), icon: HandHeartIcon, badge: 'volunteers' },
    { to: '/admin/users', label: t('Пользователи'), icon: UsersThreeIcon, also: ['/admin/broadcast'], mobile: false },
    { to: '/admin/reports', label: t('Жалобы'), icon: FlagIcon, badge: 'reports' },
    { to: '/admin/messages', label: t('Сообщения'), icon: ChatCircleDotsIcon, badge: 'messages' },
  ],
};

const ROLE_LABEL = { parent: t('Родитель'), specialist: t('Специалист / волонтёр'), admin: t('Модератор') };

// На телефоне нижняя панель мешает полю ввода чата и форме записи — там её прячем.
const HIDE_NAV = [/^\/(parent|specialist|admin)\/messages\/[^/]+$/, /^\/parent\/specialists\/[^/]+\/book$/];

function isActive(item, path, mobile = false) {
  const also = [...(item.also || []), ...(mobile ? item.mobileAlso || [] : [])];
  if (item.end) return path === item.to || also.some((p) => path.startsWith(p));
  return [item.to, ...also].some((p) => path === p || path.startsWith(`${p}/`));
}

function Badge({ value, className }) {
  if (!value) return null;
  return (
    <motion.span
      key={value}
      className={className}
      initial={{ scale: 0.4 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 18 }}
    >
      {value > 9 ? '9+' : value}
    </motion.span>
  );
}

function BottomNav({ items, counts, path }) {
  return (
    <motion.nav
      className="bottom-nav"
      aria-label={t('Основная навигация')}
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
    >
      {items.filter((item) => item.mobile !== false).map((item) => {
        const active = isActive(item, path, true);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cx('bottom-nav__item', active && 'is-active')}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span layoutId="bottom-nav-pill" className="bottom-nav__pill" transition={{ type: 'spring', stiffness: 480, damping: 36 }} />
            )}
            <Icon size={26} weight="fill" className="bottom-nav__icon" />
            <Badge value={counts[item.badge]} className="bottom-nav__badge" />
          </Link>
        );
      })}
    </motion.nav>
  );
}

function Sidebar({ user, items, counts, path, onLogout }) {
  const base = `/${user.role}`;
  return (
    <aside className="sidebar">
      <Link to={base} className="brand">
        <img src="/images/logo.png" alt="" className="brand__logo" width="44" height="44" />
        <span className="brand__text">
          <span className="brand__name">Pingo</span>
          <span className="brand__slogan">Support for every child</span>
        </span>
      </Link>
      <nav className="side-nav" aria-label={t('Основная навигация')}>
        {items.map((item) => {
          const active = isActive(item, path);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cx('side-nav__item', active && 'is-active')}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span layoutId="side-nav-pill" className="side-nav__pill" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />
              )}
              <Icon size={22} weight={active ? 'fill' : 'bold'} className="side-nav__icon" />
              <span className="side-nav__label">{item.label}</span>
              <Badge value={counts[item.badge]} className="side-nav__badge" />
            </Link>
          );
        })}
      </nav>
      <div className="sidebar__bottom">
        <InstallCard compact />
        <Link to={`${base}/notifications`} className={cx('side-link', path === `${base}/notifications` && 'is-active')}>
          <BellIcon size={20} weight="bold" />{' '}{t('Уведомления')}
          <Badge value={counts.notifications} className="side-nav__badge" />
        </Link>
        <Link to={`${base}/settings`} className={cx('side-link', path.startsWith(`${base}/settings`) && 'is-active')}>
          <GearIcon size={20} weight="bold" />{' '}{t('Настройки')}
        </Link>
        <div className="side-user">
          <Avatar avatar={user.avatar} name={user.name} size={42} />
          <div className="side-user__text">
            <strong>{user.name}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={t('Выйти')} title={t('Выйти')} onClick={onLogout}>
            <SignOutIcon size={20} weight="bold" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AppShell({ role }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const counts = useNavCounts(user);
  const items = NAV[role];
  const hideNav = HIDE_NAV.some((re) => re.test(pathname));
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    // Пока специалист заполняет анкету и проходит обучение, тур не мешает — он появится позже.
    if (!user || user.tourDone || role === 'admin' || /\/(profile\/edit|training)/.test(pathname)) return undefined;
    const t = setTimeout(() => setTourOpen(true), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tourDone, role]);

  const logout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className={cx('shell', desktop ? 'shell--desktop' : 'shell--mobile', hideNav && 'shell--no-nav')}>
      {desktop && <Sidebar user={user} items={items} counts={counts} path={pathname} onLogout={logout} />}
      <main className="shell__main" id="main">
        <AnimatedOutlet />
      </main>
      {!desktop && !hideNav && <BottomNav items={items} counts={counts} path={pathname} />}
      <Tour user={user} open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
