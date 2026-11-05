import { forwardRef, useId } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleNotchIcon, StarIcon } from '@phosphor-icons/react';
import { BOOKING_STATUS, PROFILE_STATUS } from '../lib/constants';
import { cx } from '../lib/utils';

// ---------- Кнопки ----------

function btnClass({ variant = 'primary', size = 'md', block, className }) {
  return cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className);
}

export const Button = forwardRef(function Button(
  { variant, size, block, loading, icon: Icon, iconRight: IconRight, children, className, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={btnClass({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <CircleNotchIcon size={20} weight="bold" className="spin" /> : Icon && <Icon size={20} weight="bold" />}
      {children && <span>{children}</span>}
      {IconRight && !loading && <IconRight size={20} weight="bold" />}
    </button>
  );
});

export function ButtonLink({ to, variant, size, block, icon: Icon, iconRight: IconRight, children, className, ...rest }) {
  return (
    <Link to={to} className={btnClass({ variant, size, block, className })} {...rest}>
      {Icon && <Icon size={20} weight="bold" />}
      {children && <span>{children}</span>}
      {IconRight && <IconRight size={20} weight="bold" />}
    </Link>
  );
}

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'soft', size = 'md', badge, className, weight = 'bold', to, ...rest },
  ref,
) {
  const cls = cx('icon-btn', `icon-btn--${variant}`, size !== 'md' && `icon-btn--${size}`, className);
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;
  const inner = (
    <>
      <Icon size={iconSize} weight={weight} />
      {badge ? <span className="badge-dot">{badge > 9 ? '9+' : badge}</span> : null}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={cls} aria-label={label} title={label} {...rest}>
        {inner}
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" className={cls} aria-label={label} title={label} {...rest}>
      {inner}
    </button>
  );
});

export function Spinner({ size = 28, className }) {
  return <CircleNotchIcon size={size} weight="bold" className={cx('spin', className)} aria-label="Загрузка" />;
}

// ---------- Поля ----------

export function Field({ label, hint, error, optional, children, htmlFor, className, counter }) {
  return (
    <div className={cx('field', error && 'field--error', className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {optional && <span className="field__optional">необязательно</span>}
          {counter && <span className="field__counter">{counter}</span>}
        </label>
      )}
      {hint && <p className="field__hint">{hint}</p>}
      {children}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ icon: Icon, dark, className, trailing, ...rest }, ref) {
  return (
    <div className={cx('input', dark && 'input--dark', Icon && 'input--icon', className)}>
      {Icon && <Icon size={20} className="input__icon" />}
      <input ref={ref} {...rest} />
      {trailing}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx('textarea', className)} {...rest} />;
});

export function Select({ className, children, ...rest }) {
  return (
    <div className={cx('select', className)}>
      <select {...rest}>{children}</select>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, icon: Icon, disabled }) {
  const id = useId();
  return (
    <label className={cx('toggle', disabled && 'is-disabled')} htmlFor={id}>
      {Icon && (
        <span className="toggle__icon">
          <Icon size={20} weight="bold" />
        </span>
      )}
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}

export function Checkbox({ checked, onChange, children, error }) {
  return (
    <label className={cx('checkbox', error && 'checkbox--error')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="checkbox__text">{children}</span>
    </label>
  );
}

// ---------- Чипы, табы, сегменты ----------

export function Chip({ active, onClick, children, icon: Icon, dot, className, disabled }) {
  return (
    <button
      type="button"
      className={cx('chip', active && 'chip--active', className)}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {dot && <span className="chip__dot" style={{ background: dot }} />}
      {Icon && <Icon size={18} weight={active ? 'fill' : 'bold'} />}
      <span>{children}</span>
    </button>
  );
}

export function Tabs({ value, onChange, items, layoutId = 'tabs', className }) {
  return (
    <div className={cx('tabs', className)} role="tablist">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx('tabs__item', active && 'is-active')}
            onClick={() => onChange(it.value)}
          >
            {active && (
              <motion.span layoutId={layoutId} className="tabs__pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            )}
            <span className="tabs__label">
              {it.label}
              {it.count ? <span className="tabs__count">{it.count}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Без layoutId: сегменты бывают внутри шторок и шагов мастера, где layout-анимация мешает AnimatePresence.
export function Segmented({ value, onChange, options, multiple = false, className }) {
  const isActive = (id) => (multiple ? value.includes(id) : value === id);
  const toggle = (id) => {
    if (!multiple) return onChange(id);
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className={cx('segmented', className)} role={multiple ? 'group' : 'radiogroup'}>
      {options.map((o) => {
        const active = isActive(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multiple ? undefined : 'radio'}
            aria-checked={multiple ? undefined : active}
            aria-pressed={multiple ? active : undefined}
            className={cx('segmented__item', active && 'is-active')}
            onClick={() => toggle(o.id)}
          >
            <span className="segmented__label">{o.label}</span>
            {o.hint && <span className="segmented__hint">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Статусы и рейтинг ----------

export function StatusBadge({ status, kind = 'booking', size, className }) {
  const meta = (kind === 'profile' ? PROFILE_STATUS : BOOKING_STATUS)[status];
  if (!meta) return null;
  return (
    <span className={cx('badge', `badge--${meta.tone}`, size === 'lg' && 'badge--lg', className)}>
      <span className="badge__dot" />
      {kind === 'profile' ? meta.label : meta.short}
    </span>
  );
}

export function Stars({ value = 0, size = 16, className }) {
  return (
    <span className={cx('stars', className)} aria-label={`Оценка ${value.toFixed(1)} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} size={size} weight={value >= i - 0.25 ? 'fill' : 'regular'} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} из 5`}
          className={cx('star-input__star', value >= i && 'is-on')}
          onClick={() => onChange(i)}
          whileTap={{ scale: 0.8 }}
          animate={{ scale: value === i ? [1, 1.25, 1] : 1 }}
        >
          <StarIcon size={34} weight={value >= i ? 'fill' : 'regular'} />
        </motion.button>
      ))}
    </div>
  );
}

export function Rating({ rating, count, compact }) {
  if (!rating) return <span className="rating rating--empty">Новый</span>;
  return (
    <span className="rating">
      <StarIcon size={15} weight="fill" />
      <strong>{rating.toFixed(1).replace('.', ',')}</strong>
      {!compact && <span>({count})</span>}
    </span>
  );
}

export function ProgressRing({ value = 0, size = 120, stroke = 12, color = 'var(--yellow)', track = 'rgba(255,255,255,.12)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__label">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, className }) {
  return (
    <div className={cx('progress', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="progress__fill"
        initial={false}
        animate={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
        transition={{ type: 'spring', stiffness: 160, damping: 26 }}
      />
    </div>
  );
}

// ---------- Списки с каскадной анимацией ----------

export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
export const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } },
};

export function Stagger({ as = 'div', className, children, ...rest }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={listVariants} initial="hidden" animate="show" {...rest}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ as = 'div', className, children, ...rest }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={itemVariants} {...rest}>
      {children}
    </Comp>
  );
}

export function SectionLabel({ children, action }) {
  return (
    <div className="section-label">
      <span>{children}</span>
      {action}
    </div>
  );
}
