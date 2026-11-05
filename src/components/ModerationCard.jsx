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

// Состояние анкеты специалиста: черновик → на модерации → одобрена / отклонена с причиной.
export function ModerationCard({ profile, issues }) {
  const training = trainingProgress(profile);
  const { status, published } = profile;
  const conf = {
    draft: {
      icon: NotePencilIcon,
      tone: 'draft',
      title: 'Заполните анкету',
      text: 'После проверки модератором родители увидят вас в каталоге.',
    },
    pending: {
      icon: HourglassMediumIcon,
      tone: 'pending',
      title: published ? 'Изменения на проверке' : 'Анкета на проверке',
      text: published
        ? 'Пока модератор смотрит изменения, в каталоге показывается прежняя версия.'
        : `Отправлена ${fmtAgo(profile.submittedAt)}. Обычно проверка занимает до 24 часов — пока настройте расписание.`,
    },
    approved: {
      icon: SealCheckIcon,
      tone: 'approved',
      title: 'Вы в каталоге',
      text: 'Анкета одобрена — родители видят вас и могут записаться.',
    },
    rejected: {
      icon: WarningCircleIcon,
      tone: 'rejected',
      title: published ? 'Изменения отклонены' : 'Анкета отклонена',
      text: published ? 'В каталоге осталась прежняя версия анкеты.' : 'Исправьте анкету и отправьте её снова.',
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
          <strong>Причина:</strong> {profile.rejectionReason}
        </blockquote>
      )}
      {status === 'draft' && (
        <div className="mod-card__progress">
          <div className="mod-card__row">
            <span>Анкета</span>
            <span>{Math.round(filled * 100)}%</span>
          </div>
          <ProgressBar value={filled} />
          <div className="mod-card__row">
            <span>Обучение</span>
            <span>
              {training.done}/{training.total}
            </span>
          </div>
          <ProgressBar value={training.done / training.total} />
        </div>
      )}
      {status !== 'pending' && status !== 'approved' && (
        <ButtonLink to="/specialist/profile/edit" variant="dark" iconRight={ArrowRightIcon}>
          {status === 'draft' ? 'Продолжить заполнение' : 'Исправить анкету'}
        </ButtonLink>
      )}
    </motion.section>
  );
}
