import { Link } from 'react-router-dom';
import { CaretRightIcon } from '@phosphor-icons/react';
import { cx } from '../lib/utils';

export function MenuLink({ to, onClick, icon: Icon, children, hint, danger, badge }) {
  const inner = (
    <>
      {Icon && (
        <span className="menu-link__icon">
          <Icon size={20} weight="bold" />
        </span>
      )}
      <span className="menu-link__text">
        <span>{children}</span>
        {hint && <span className="menu-link__hint">{hint}</span>}
      </span>
      {badge ? <span className="menu-link__badge">{badge}</span> : null}
      {!danger && <CaretRightIcon size={18} weight="bold" className="menu-link__caret" />}
    </>
  );
  const cls = cx('menu-link', danger && 'menu-link--danger');
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
