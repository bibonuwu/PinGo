import { motion } from 'framer-motion';
import { CheckIcon } from '@phosphor-icons/react';
import { AVATARS, AVATAR_MAP, avatarSrc } from '../lib/constants';
import { cx, initials } from '../lib/utils';
import { t } from '../i18n';

export function Avatar({ avatar, name = '', size = 48, ring = false, className }) {
  const a = avatar ? AVATAR_MAP[avatar] : null;
  const style = { width: size, height: size };
  if (a) {
    return (
      <span className={cx('avatar', ring && 'avatar--ring', className)} style={{ ...style, background: a.color }}>
        <img src={avatarSrc(a.id)} alt="" draggable="false" loading="lazy" />
      </span>
    );
  }
  return (
    <span
      className={cx('avatar avatar--initials', ring && 'avatar--ring', className)}
      style={{ ...style, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function AvatarPicker({ value, onChange, size = 76 }) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label={t('Аватар')}>
      {AVATARS.map((a, i) => {
        const active = value === a.id;
        return (
          <motion.button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={a.label}
            className={cx('avatar-picker__item', active && 'is-active')}
            onClick={() => onChange(a.id)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: active ? 1.08 : 1 }}
            whileHover={{ scale: active ? 1.1 : 1.05 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22, delay: i * 0.03 }}
          >
            <Avatar avatar={a.id} size={size} />
            {active && (
              <motion.span className="avatar-picker__check" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckIcon size={14} weight="bold" />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
