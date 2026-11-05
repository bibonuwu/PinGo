import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRightIcon, ClockIcon, HeartIcon, SealCheckIcon, SparkleIcon } from '@phosphor-icons/react';
import { freshSlots } from '../hooks/useCatalog';
import { kindLabel } from '../services/profiles';
import { cx, fmtDayTime } from '../lib/utils';
import { Avatar } from './Avatar';
import { Rating, itemVariants } from './ui';

export function SpecialistCard({ entry, match, childName, favorite, onToggleFavorite, to, now }) {
  const { user, data } = entry;
  const next = freshSlots(entry.slots, now)[0];
  return (
    <motion.article
      className="sp-card"
      variants={itemVariants}
      whileHover={{ y: -4 }}
      layout="position"
    >
      <Link to={to} className="card-link" aria-label={`${user.name} — открыть анкету`} />
      <div className="sp-card__head">
        <Avatar avatar={user.avatar} name={user.name} size={52} />
        <div className="sp-card__who">
          <h3 className="sp-card__name">
            {user.name}
            {entry.profile.verifiedAt && <SealCheckIcon size={16} weight="fill" className="ico-verified" aria-label="Подтверждён Pingo" />}
          </h3>
          <p className="sp-card__title">{data.title}</p>
        </div>
      </div>
      <div className="sp-card__meta">
        <Rating rating={entry.rating} count={entry.reviewsCount} />
        <span className={cx('kind-tag', data.kind === 'volunteer' && 'kind-tag--volunteer')}>{kindLabel(data.kind)}</span>
      </div>
      {match?.good && (
        <p className="match-tag">
          <SparkleIcon size={14} weight="fill" /> Подходит · {childName}
        </p>
      )}
      <p className="sp-card__next">
        <ClockIcon size={15} weight="bold" />
        {next ? fmtDayTime(next.start, now) : 'Нет свободных окон'}
      </p>
      <div className="sp-card__foot">
        <span className="pill-white">{`Опыт: ${data.experienceYears} г.`}</span>
        <span className="arrow-btn" aria-hidden="true">
          <ArrowUpRightIcon size={20} weight="bold" />
        </span>
      </div>
      {onToggleFavorite && (
        <motion.button
          type="button"
          className={cx('fav-btn', favorite && 'is-active')}
          aria-pressed={favorite}
          aria-label={favorite ? 'Убрать из избранного' : 'В избранное'}
          onClick={onToggleFavorite}
          whileTap={{ scale: 0.8 }}
        >
          <motion.span key={String(favorite)} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
            <HeartIcon size={18} weight={favorite ? 'fill' : 'bold'} />
          </motion.span>
        </motion.button>
      )}
    </motion.article>
  );
}
