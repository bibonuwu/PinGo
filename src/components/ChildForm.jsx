import { AnimatePresence, motion } from 'framer-motion';
import {
  CakeIcon,
  CheckCircleIcon,
  EarIcon,
  EyeIcon,
  HandGrabbingIcon,
  ListNumbersIcon,
  PuzzlePieceIcon,
  SmileyIcon,
} from '@phosphor-icons/react';
import { LEARNING_STYLES, NEEDS } from '../lib/constants';
import { ageFromBirthDate, birthDateBounds, cx, fmtAge } from '../lib/utils';
import { Chip, Field, Input, Textarea } from './ui';

const STYLE_ICONS = {
  visual: EyeIcon,
  auditory: EarIcon,
  kinesthetic: HandGrabbingIcon,
  play: PuzzlePieceIcon,
  structured: ListNumbersIcon,
};

const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function AboutFields({ data, set, errors = {} }) {
  const bounds = birthDateBounds();
  const age = data.birthDate ? ageFromBirthDate(data.birthDate) : null;
  const ageOk = age != null && age >= 1 && age <= 18;
  return (
    <div className="form-stack">
      <Field label="Имя ребёнка" htmlFor="child-name" error={errors.name}>
        <Input
          id="child-name"
          icon={SmileyIcon}
          placeholder="Например, Алия"
          value={data.name}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      <Field label="Дата рождения" htmlFor="child-birth" hint="Pingo помогает детям от 1 до 18 лет" error={errors.birthDate}>
        <Input
          id="child-birth"
          icon={CakeIcon}
          type="date"
          min={bounds.min}
          max={bounds.max}
          value={data.birthDate}
          onChange={(e) => set({ birthDate: e.target.value })}
        />
      </Field>
      <AnimatePresence>
        {ageOk && (
          <motion.div
            className="age-badge"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          >
            <span className="age-badge__num">{age}</span>
            <span>{fmtAge(age).replace(/^\d+\s/, '')}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NeedsFields({ data, set, errors = {} }) {
  return (
    <div className="form-stack">
      <div className="chips chips--wrap chips--lg">
        {NEEDS.map((n) => (
          <Chip key={n.id} active={data.needs.includes(n.id)} onClick={() => set({ needs: toggleIn(data.needs, n.id) })}>
            {n.label}
          </Chip>
        ))}
      </div>
      <AnimatePresence>
        {data.needs.includes('other') && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Field label="Что ещё важно?" htmlFor="child-other" error={errors.needsOther}>
              <Input
                id="child-other"
                placeholder="Например, эпилепсия или тревожность"
                value={data.needsOther}
                maxLength={120}
                onChange={(e) => set({ needsOther: e.target.value })}
              />
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StyleFields({ data, set }) {
  return (
    <div className="style-grid">
      {LEARNING_STYLES.map((s, i) => {
        const Icon = STYLE_ICONS[s.id];
        const active = data.learningStyles.includes(s.id);
        return (
          <motion.button
            key={s.id}
            type="button"
            className={cx('style-card', active && 'is-active')}
            aria-pressed={active}
            onClick={() => set({ learningStyles: toggleIn(data.learningStyles, s.id) })}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="style-card__icon">
              <Icon size={26} weight={active ? 'fill' : 'bold'} />
            </span>
            <span className="style-card__text">
              <strong>{s.label}</strong>
              <span>{s.hint}</span>
            </span>
            {active && <CheckCircleIcon size={22} weight="fill" className="style-card__check" />}
          </motion.button>
        );
      })}
    </div>
  );
}

export function GoalsFields({ data, set }) {
  return (
    <div className="form-stack">
      <Field label="Цели занятий" optional counter={`${data.goals.length}/400`}>
        <Textarea
          rows={3}
          maxLength={400}
          placeholder="Например: расширить словарный запас, научиться просить о помощи"
          value={data.goals}
          onChange={(e) => set({ goals: e.target.value })}
        />
      </Field>
      <Field label="Что важно знать специалисту" optional counter={`${data.notes.length}/600`}>
        <Textarea
          rows={3}
          maxLength={600}
          placeholder="Что помогает успокоиться, чего избегать, любимые темы и игрушки, нужные адаптации"
          value={data.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
