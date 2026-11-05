import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { motion } from 'framer-motion';
import {
  BellIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  CircleIcon,
  GearIcon,
  GraduationCapIcon,
  LifebuoyIcon,
  NotePencilIcon,
  PencilSimpleIcon,
  SealCheckIcon,
  SignOutIcon,
} from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { cx, plural } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavCounts } from '../../hooks/useNavCounts';
import { describeProfile, kindLabel, profileIssues, submitProfile, trainingProgress, withdrawProfile } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { CertificateList } from '../../components/Certificate';
import { EditAccountSheet } from '../../components/EditAccountSheet';
import { MenuLink } from '../../components/MenuLink';
import { ModerationCard } from '../../components/ModerationCard';
import { Button, ButtonLink, StatusBadge } from '../../components/ui';

export default function SpecialistProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const counts = useNavCounts(user);
  const profile = useLiveQuery(() => db.profiles.get(user.id), [user.id]);
  const rulesCount = useLiveQuery(() => db.availability.where('specialistId').equals(user.id).count(), [user.id]);
  const certificates = useLiveQuery(
    async () => (await db.certificates.where('userId').equals(user.id).toArray()).sort((a, b) => b.issuedAt - a.issuedAt),
    [user.id],
  );
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!profile || rulesCount === undefined || !certificates) return <div className="page page--loading" />;

  const issues = profileIssues(profile);
  const training = trainingProgress(profile);
  const shown = profile.published ?? profile.draft;
  const info = describeProfile(shown);
  const checklist = [
    { done: issues.filter((i) => !['training', 'agreements'].includes(i.field)).length === 0, label: 'Анкета заполнена', to: '/specialist/profile/edit' },
    { done: training.complete, label: `Обучение Pingo · ${training.done}/${training.total}`, to: '/specialist/training' },
    { done: !issues.some((i) => i.field === 'agreements'), label: 'Согласия подтверждены', to: '/specialist/profile/edit#agreements' },
    { done: rulesCount > 0, label: rulesCount ? `Расписание · ${rulesCount} ${plural(rulesCount, ['окно', 'окна', 'окон'])}` : 'Расписание', to: '/specialist/availability' },
  ];

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="page sp-profile">
      <motion.section className="sp-profile__hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="profile-id__avatar">
          <Avatar avatar={user.avatar} name={user.name} size={112} ring />
          <button type="button" className="profile-id__edit" aria-label="Редактировать профиль" onClick={() => setEditOpen(true)}>
            <PencilSimpleIcon size={20} weight="bold" />
          </button>
        </div>
        <div className="sp-profile__who">
          <h1 className="page-title">{user.name}</h1>
          <p className="muted">{shown.title || 'Заголовок анкеты пока не заполнен'}</p>
          <div className="profile-hero__meta">
            <span className={cx('kind-tag', shown.kind === 'volunteer' && 'kind-tag--volunteer')}>{kindLabel(shown.kind)}</span>
            <StatusBadge kind="profile" status={profile.status} />
            {profile.verifiedAt && (
              <span className="verified-tag">
                <SealCheckIcon size={16} weight="fill" /> Подтверждён Pingo
              </span>
            )}
          </div>
        </div>
      </motion.section>

      <div className="sp-profile__grid">
        <div>
          <ModerationCard profile={profile} issues={issues} />

          <section className="card-section">
            <h2>Готовность</h2>
            <ul className="checklist">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link to={c.to} className={cx('checklist__item', c.done && 'is-done')}>
                    {c.done ? <CheckCircleIcon size={22} weight="fill" /> : <CircleIcon size={22} weight="bold" />}
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="btn-row">
              {profile.status === 'pending' ? (
                <Button variant="soft" loading={busy} onClick={() => run(() => withdrawProfile(user.id), 'Заявка отозвана — анкету снова можно редактировать')}>
                  Отозвать заявку
                </Button>
              ) : (
                <>
                  <ButtonLink to="/specialist/profile/edit" variant="soft" icon={NotePencilIcon}>
                    Редактировать анкету
                  </ButtonLink>
                  {(profile.status !== 'approved' || JSON.stringify(profile.draft) !== JSON.stringify(profile.published)) && (
                    <Button
                      variant="dark"
                      loading={busy}
                      disabled={issues.length > 0}
                      onClick={() => run(() => submitProfile(user.id), 'Анкета отправлена на модерацию')}
                    >
                      Отправить на модерацию
                    </Button>
                  )}
                </>
              )}
            </div>
            {issues.length > 0 && profile.status !== 'pending' && <p className="muted small">Осталось: {issues.map((i) => i.text.toLowerCase()).join('; ')}.</p>}
          </section>

          {(profile.published || certificates.length > 0) && (
            <section className="card-section">
              <h2>Сертификаты Pingo</h2>
              {certificates.length ? (
                <CertificateList items={certificates} />
              ) : (
                <p className="muted small">
                  Модератор Pingo вручает сертификаты лучшим волонтёрам и специалистам — за отзывы родителей и часы занятий.
                  Они появятся здесь и в вашей анкете.
                </p>
              )}
            </section>
          )}
        </div>

        <div>
          <section className="card-section">
            <h2>{profile.published ? 'Как вас видят родители' : 'Предпросмотр анкеты'}</h2>
            <p className="prewrap">{shown.description || 'Описание пока пустое.'}</p>
            {info.specializations.length > 0 && (
              <div className="tags">
                {info.specializations.map((s) => (
                  <span key={s} className="tag">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <p className="muted small">
              Дети {shown.ageMin}–{shown.ageMax} лет · {info.formats.join(', ').toLowerCase()}
              {shown.formats.includes('offline') && shown.city ? ` (${shown.city})` : ''} · {info.languages.join(', ')}
            </p>
          </section>

          <nav className="white-card menu menu--bordered">
            <MenuLink icon={NotePencilIcon} to="/specialist/profile/edit">
              Анкета
            </MenuLink>
            <MenuLink icon={GraduationCapIcon} to="/specialist/training" hint={`${training.done} из ${training.total} модулей`}>
              Обучение Pingo
            </MenuLink>
            <MenuLink icon={CalendarDotsIcon} to="/specialist/availability">
              Расписание
            </MenuLink>
            <MenuLink icon={BellIcon} to="/specialist/notifications" badge={counts.notifications}>
              Уведомления
            </MenuLink>
            <MenuLink icon={GearIcon} to="/specialist/settings" hint="Установка приложения, доступность, данные">
              Настройки
            </MenuLink>
            <MenuLink icon={LifebuoyIcon} to="/specialist/help">
              Помощь
            </MenuLink>
            <MenuLink icon={SignOutIcon} onClick={logout} danger>
              Выйти
            </MenuLink>
          </nav>
        </div>
      </div>

      <EditAccountSheet user={user} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
