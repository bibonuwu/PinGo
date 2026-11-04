import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HourglassMediumIcon, MapPinIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { NEED_MAP } from '../lib/constants';
import { ageFromBirthDate, cx, fmtAge, fmtCountdown, fmtDay, fmtRange } from '../lib/utils';
import { displayStatus, roomState, roomWindow } from '../services/bookings';
import { Avatar } from './Avatar';
import { ButtonLink, StatusBadge, itemVariants } from './ui';

// viewer: 'parent' — показываем специалиста; 'specialist' — показываем ребёнка и родителя.
export function BookingCard({ booking, viewer, counterpart, child, now, to, actions }) {
  const status = displayStatus(booking, now);
  const room = roomState(booking, now);
  const { opensAt } = roomWindow(booking);
  const person =
    viewer === 'parent'
      ? { avatar: counterpart?.avatar, name: counterpart?.name ?? 'Специалист', sub: child ? `для ${child.name}` : '' }
      : {
          avatar: child?.avatar,
          name: child ? `${child.name}, ${fmtAge(ageFromBirthDate(child.birthDate))}` : 'Ребёнок',
          sub: counterpart ? `родитель: ${counterpart.name}` : '',
        };

  return (
    <motion.article className={cx('bk-card', `bk-card--${status}`)} variants={itemVariants} layout="position">
      <Link to={to} className="card-link" aria-label="Открыть запись" />
      <div className="bk-card__when">
        <span className="bk-card__day">{fmtDay(booking.start, now)}</span>
        <span className="bk-card__time">{fmtRange(booking.start, booking.end)}</span>
      </div>
      <div className="bk-card__row">
        <Avatar avatar={person.avatar} name={person.name} size={44} />
        <div className="bk-card__who">
          <strong>{person.name}</strong>
          <span>
            {person.sub}
            {booking.format === 'offline' && (
              <>
                {' · '}
                <MapPinIcon size={13} weight="bold" /> очно
              </>
            )}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>
      {viewer === 'specialist' && child?.needs?.length > 0 && (
        <div className="bk-card__needs">
          {child.needs.slice(0, 3).map((n) => (
            <span key={n} className="tag">
              {NEED_MAP[n]?.label}
            </span>
          ))}
        </div>
      )}
      {room === 'open' && (
        <ButtonLink to={`/room/${booking.id}`} variant="primary" size="sm" icon={VideoCameraIcon} className="bk-card__cta">
          Войти в видеокомнату
        </ButtonLink>
      )}
      {room === 'waiting' && (
        <p className="bk-card__hint">
          <HourglassMediumIcon size={15} weight="bold" /> Видеокомната откроется через {fmtCountdown(opensAt - now)}
        </p>
      )}
      {actions && <div className="bk-card__actions">{actions}</div>}
    </motion.article>
  );
}
