import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  HourglassMediumIcon,
  NotePencilIcon,
  SealCheckIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { fmtAgo } from '../lib/utils';
import { trainingProgress } from '../services/profiles';
import { ButtonLink, ProgressBar } from './ui';
import { t } from '../i18n';

// Состояние анкеты специалиста: черновик → на модерации → одобрена / отклонена с причиной.
export function ModerationCard({ profile, issues }) {
  const training = trainingProgress(profile);
  const { status, published } = profile;
  const conf = {
    draft: {
      icon: NotePencilIcon,
      tone: 'draft',
      title: t('Заполните анкету'),
      text: t('После проверки модератором родители увидят вас в каталоге.'),
    },
    pending: {
      icon: HourglassMediumIcon,
      tone: 'pending',
      title: published ? t('Изменения на проверке') : t('Анкета на проверке'),
      text: published
        ? t('Пока модератор смотрит изменения, в каталоге показывается прежняя версия.')
        : t('Отправлена {fmtAgo}. Обычно проверка занимает до 24 часов — пока настройте расписание.', { fmtAgo: fmtAgo(profile.submittedAt) }),
    },
    approved: {
      icon: SealCheckIcon,
      tone: 'approved',
      title: t('Вы в каталоге'),
      text: t('Анкета одобрена — родители видят вас и могут записаться.'),
    },
    rejected: {
      icon: WarningCircleIcon,
      tone: 'rejected',
      title: published ? t('Изменения отклонены') : t('Анкета отклонена'),
      text: published ? t('В каталоге осталась прежняя версия анкеты.') : t('Исправьте анкету и отправьте её снова.'),
    },
  }[status];
  const Icon = conf.icon;
  const filled = status === 'draft' ? Math.max(0, 10 - issues.length) / 10 : 1;

  return (
    <motion.section
      className={`mod-card mod-card--${conf.tone}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <div className="mod-card__head">
        <span className="mod-card__icon">
          <Icon size={28} weight="fill" />
        </span>
        <div>
          <h2>{conf.title}</h2>
          <p>{conf.text}</p>
        </div>
      </div>
      {status === 'rejected' && profile.rejectionReason && (
        <blockquote className="mod-card__reason">
          <strong>{t('Причина:')}</strong> {profile.rejectionReason}
        </blockquote>
      )}
      {status === 'draft' && (
        <div className="mod-card__progress">
          <div className="mod-card__row">
            <span>{t('Анкета')}</span>
            <span>{Math.round(filled * 100)}%</span>
          </div>
          <ProgressBar value={filled} />
          <div className="mod-card__row">
            <span>{t('Обучение')}</span>
            <span>
              {training.done}/{training.total}
            </span>
          </div>
          <ProgressBar value={training.done / training.total} />
        </div>
      )}
      {status !== 'pending' && status !== 'approved' && (
        <ButtonLink to="/specialist/profile/edit" variant="dark" iconRight={ArrowRightIcon}>
          {status === 'draft' ? t('Продолжить заполнение') : t('Исправить анкету')}
        </ButtonLink>
      )}
    </motion.section>
  );
}
