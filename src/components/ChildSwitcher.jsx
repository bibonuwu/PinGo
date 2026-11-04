import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlusIcon } from '@phosphor-icons/react';
import { NEED_MAP } from '../lib/constants';
import { ageFromBirthDate, cx, fmtAge } from '../lib/utils';
import { Avatar } from './Avatar';

// «Кто занимается сегодня?» — выбранный ребёнок определяет подбор специалистов и настройки доступности.
export function ChildSwitcher({ items, activeId, onSelect, addTo }) {
  return (
    <div className="child-switch" role="radiogroup" aria-label="Выбор ребёнка">
      {items.map((c) => {
        const active = c.id === activeId;
        const needs = c.needs.map((n) => NEED_MAP[n]?.label).filter(Boolean);
        return (
          <motion.button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={cx('child-chip', active && 'is-active')}
            onClick={() => onSelect(c.id)}
            whileTap={{ scale: 0.97 }}
            layout
          >
            {active && <motion.span layoutId="child-ring" className="child-chip__ring" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <Avatar avatar={c.avatar} name={c.name} size={48} />
            <span className="child-chip__text">
              <strong>{c.name}</strong>
              <span>
                {fmtAge(ageFromBirthDate(c.birthDate))}
                {needs[0] ? ` · ${needs[0]}` : ''}
              </span>
            </span>
          </motion.button>
        );
      })}
      {addTo && (
        <Link to={addTo} className="child-chip child-chip--add" aria-label="Добавить ребёнка">
          <span className="child-chip__plus">
            <PlusIcon size={22} weight="bold" />
          </span>
          <span className="child-chip__text">
            <strong>Добавить</strong>
            <span>профиль ребёнка</span>
          </span>
        </Link>
      )}
    </div>
  );
}
