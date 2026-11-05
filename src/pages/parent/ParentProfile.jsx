import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellIcon,
  CalendarDotsIcon,
  ChatCircleDotsIcon,
  GearIcon,
  HeartIcon,
  LifebuoyIcon,
  PencilSimpleIcon,
  PlusIcon,
  SignOutIcon,
  StarIcon,
  UserPlusIcon,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useChildren } from '../../hooks/useBookings';
import { useNavCounts } from '../../hooks/useNavCounts';
import { useThemeColor } from '../../hooks/useThemeColor';
import { NEED_MAP } from '../../lib/constants';
import { ageFromBirthDate, fmtAge } from '../../lib/utils';
import { Avatar } from '../../components/Avatar';
import { EditAccountSheet } from '../../components/EditAccountSheet';
import { MenuLink } from '../../components/MenuLink';
import { IconButton, Stagger, StaggerItem } from '../../components/ui';
import { t } from '../../i18n';

export default function ParentProfile() {
  useThemeColor('#F4C600');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const children = useChildren(user.id);
  const counts = useNavCounts(user);
  const [editOpen, setEditOpen] = useState(false);

  const logout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="page profile-page">
      <div className="profile-top">
        <h1>{t('Профиль')}</h1>
        <div className="profile-top__actions">
          <IconButton icon={StarIcon} label={t('Избранные специалисты')} variant="white" to="/parent/specialists?fav=1" />
          <IconButton icon={ChatCircleDotsIcon} label={t('Сообщения')} variant="white" to="/parent/messages" badge={counts.messages} />
          <IconButton icon={CalendarDotsIcon} label={t('Записи')} variant="white" to="/parent/bookings" />
        </div>
      </div>

      <motion.div className="profile-id" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="profile-id__avatar">
          <Avatar avatar={user.avatar} name={user.name} size={124} className="avatar--dark" />
          <button type="button" className="profile-id__edit" aria-label={t('Редактировать профиль')} onClick={() => setEditOpen(true)}>
            <PencilSimpleIcon size={20} weight="bold" />
          </button>
        </div>
        <h2 className="profile-id__name">{user.name}</h2>
        <p className="profile-id__email">{user.email}</p>
        <p className="profile-id__sub">{t('Родитель')}</p>
      </motion.div>

      <div className="profile-cards">
        <section className="white-card">
          <h3 className="white-card__title">{t('Дети')}</h3>
          <Stagger as="ul" className="kids">
            {(children ?? []).map((c) => (
              <StaggerItem as="li" key={c.id}>
                <Link to={`/parent/children/${c.id}`} className="kid">
                  <Avatar avatar={c.avatar} name={c.name} size={56} />
                  <span className="kid__text">
                    <strong>
                      {c.name}, {fmtAge(ageFromBirthDate(c.birthDate))}
                      {c.id === user.activeChildId && <span className="tag tag--yellow">{t('Активный')}</span>}
                    </strong>
                    <span>{c.needs.map((n) => NEED_MAP[n]?.label).join(', ') || t('Особенности не указаны')}</span>
                  </span>
                </Link>
              </StaggerItem>
            ))}
            <StaggerItem as="li">
              <Link to="/parent/children/new" className="kid kid--add">
                <span className="kid__plus">
                  <PlusIcon size={26} weight="bold" />
                </span>
                <span className="kid__text">
                  <strong>{t('Добавить профиль ребёнка')}</strong>
                  <span>{t('Чтобы специалисты знали, с кем будут заниматься')}</span>
                </span>
              </Link>
            </StaggerItem>
          </Stagger>
        </section>

        <nav className="white-card menu">
          <MenuLink icon={PencilSimpleIcon} onClick={() => setEditOpen(true)}>
            {t('Редактировать профиль')}
          </MenuLink>
          <MenuLink icon={CalendarDotsIcon} to="/parent/bookings">
            {t('Мои записи')}
          </MenuLink>
          <MenuLink icon={ChatCircleDotsIcon} to="/parent/messages" badge={counts.messages}>
            {t('Сообщения')}
          </MenuLink>
          <MenuLink icon={HeartIcon} to="/parent/specialists?fav=1">
            {t('Избранные специалисты')}
          </MenuLink>
          <MenuLink icon={UserPlusIcon} to="/parent/children/new">
            {t('Добавить ребёнка')}
          </MenuLink>
          <MenuLink icon={BellIcon} to="/parent/notifications" badge={counts.notifications}>
            {t('Уведомления')}
          </MenuLink>
          <MenuLink icon={GearIcon} to="/parent/settings" hint={t('Установка приложения, язык, доступность, данные')}>
            {t('Настройки')}
          </MenuLink>
          <MenuLink icon={LifebuoyIcon} to="/parent/help">
            {t('Помощь и поддержка')}
          </MenuLink>
          <MenuLink icon={SignOutIcon} onClick={logout} danger>
            {t('Выйти')}
          </MenuLink>
        </nav>
      </div>

      <EditAccountSheet user={user} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
