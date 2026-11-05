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
import { t } from '../../i18n';

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
    { done: issues.filter((i) => !['training', 'agreements'].includes(i.field)).length === 0, label: t('Анкета заполнена'), to: '/specialist/profile/edit' },
    { done: training.complete, label: t('Обучение Pingo · {done}/{total}', { done: training.done, total: training.total }), to: '/specialist/training' },
    { done: !issues.some((i) => i.field === 'agreements'), label: t('Согласия подтверждены'), to: '/specialist/profile/edit#agreements' },
    { done: rulesCount > 0, label: rulesCount ? t('Расписание · {rulesCount} {plural}', { rulesCount, plural: plural(rulesCount, [t('окно'), t('окна'), t('окон')]) }) : t('Расписание'), to: '/specialist/availability' },
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
          <button type="button" className="profile-id__edit" aria-label={t('Редактировать профиль')} onClick={() => setEditOpen(true)}>
            <PencilSimpleIcon size={20} weight="bold" />
          </button>
        </div>
        <div className="sp-profile__who">
          <h1 className="page-title">{user.name}</h1>
          <p className="muted">{shown.title || t('Заголовок анкеты пока не заполнен')}</p>
          <div className="profile-hero__meta">
            <span className={cx('kind-tag', shown.kind === 'volunteer' && 'kind-tag--volunteer')}>{kindLabel(shown.kind)}</span>
            <StatusBadge kind="profile" status={profile.status} />
            {profile.verifiedAt && (
              <span className="verified-tag">
                <SealCheckIcon size={16} weight="fill" />{' '}{t('Подтверждён Pingo')}
              </span>
            )}
          </div>
        </div>
      </motion.section>

      <div className="sp-profile__grid">
        <div>
          <ModerationCard profile={profile} issues={issues} />

          <section className="card-section">
            <h2>{t('Готовность')}</h2>
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
                <Button variant="soft" loading={busy} onClick={() => run(() => withdrawProfile(user.id), t('Заявка отозвана — анкету снова можно редактировать'))}>
                  {t('Отозвать заявку')}
                </Button>
              ) : (
                <>
                  <ButtonLink to="/specialist/profile/edit" variant="soft" icon={NotePencilIcon}>
                    {t('Редактировать анкету')}
                  </ButtonLink>
                  {(profile.status !== 'approved' || JSON.stringify(profile.draft) !== JSON.stringify(profile.published)) && (
                    <Button
                      variant="dark"
                      loading={busy}
                      disabled={issues.length > 0}
                      onClick={() => run(() => submitProfile(user.id), t('Анкета отправлена на модерацию'))}
                    >
                      {t('Отправить на модерацию')}
                    </Button>
                  )}
                </>
              )}
            </div>
            {issues.length > 0 && profile.status !== 'pending' && <p className="muted small">{t('Осталось:')}{' '}{issues.map((i) => i.text.toLowerCase()).join('; ')}.</p>}
          </section>

          {(profile.published || certificates.length > 0) && (
            <section className="card-section">
              <h2>{t('Сертификаты Pingo')}</h2>
              {certificates.length ? (
                <CertificateList items={certificates} />
              ) : (
                <p className="muted small">
                  {t('Модератор Pingo вручает сертификаты лучшим волонтёрам и специалистам — за отзывы родителей и часы занятий. Они появятся здесь и в вашей анкете.')}
                </p>
              )}
            </section>
          )}
        </div>

        <div>
          <section className="card-section">
            <h2>{profile.published ? t('Как вас видят родители') : t('Предпросмотр анкеты')}</h2>
            <p className="prewrap">{shown.description || t('Описание пока пустое.')}</p>
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
              {t('Дети {ageMin}–{ageMax} лет · {toLowerCase}{p3} · {join}', { ageMin: shown.ageMin, ageMax: shown.ageMax, toLowerCase: info.formats.join(', ').toLowerCase(), p3: shown.formats.includes('offline') && shown.city ? ` (${shown.city})` : '', join: info.languages.join(', ') })}
            </p>
          </section>

          <nav className="white-card menu menu--bordered">
            <MenuLink icon={NotePencilIcon} to="/specialist/profile/edit">
              {t('Анкета')}
            </MenuLink>
            <MenuLink icon={GraduationCapIcon} to="/specialist/training" hint={t('{done} из {total} модулей', { done: training.done, total: training.total })}>
              {t('Обучение Pingo')}
            </MenuLink>
            <MenuLink icon={CalendarDotsIcon} to="/specialist/availability">
              {t('Расписание')}
            </MenuLink>
            <MenuLink icon={BellIcon} to="/specialist/notifications" badge={counts.notifications}>
              {t('Уведомления')}
            </MenuLink>
            <MenuLink icon={GearIcon} to="/specialist/settings" hint={t('Установка приложения, язык, доступность, данные')}>
              {t('Настройки')}
            </MenuLink>
            <MenuLink icon={LifebuoyIcon} to="/specialist/help">
              {t('Помощь')}
            </MenuLink>
            <MenuLink icon={SignOutIcon} onClick={logout} danger>
              {t('Выйти')}
            </MenuLink>
          </nav>
        </div>
      </div>

      <EditAccountSheet user={user} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
