import { motion } from 'framer-motion';
import { BookOpenTextIcon, CircleHalfIcon, SparkleIcon, WavesIcon } from '@phosphor-icons/react';
import { LINE_SPACINGS, TEXT_SIZES, describeAccessibility } from '../lib/constants';
import { cx } from '../lib/utils';
import { Button, Field, Segmented, Toggle } from './ui';

// Настройки доступности ребёнка (или пользователя) с живым предпросмотром.
export function AccessibilityForm({ value, onChange, suggestion, suggestionFor, idPrefix = 'a11y' }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const scale = TEXT_SIZES.find((t) => t.id === value.textSize)?.scale ?? 1;
  const lh = LINE_SPACINGS.find((l) => l.id === value.lineSpacing)?.value ?? 1.5;
  const differs = suggestion && JSON.stringify(suggestion) !== JSON.stringify(value);

  return (
    <div className="a11y-form">
      {differs && (
        <motion.div className="a11y-suggest" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <SparkleIcon size={20} weight="fill" />
          <div>
            <strong>Pingo рекомендует{suggestionFor ? ` · ${suggestionFor}` : ''}</strong>
            <span>{describeAccessibility(suggestion).join(', ') || 'стандартные настройки'}</span>
          </div>
          <Button size="sm" variant="dark" onClick={() => onChange(suggestion)}>
            Применить
          </Button>
        </motion.div>
      )}
      <Field label="Размер текста">
        <Segmented value={value.textSize} onChange={(v) => set({ textSize: v })} options={TEXT_SIZES} layoutId={`${idPrefix}-size`} />
      </Field>
      <Field label="Межстрочный интервал">
        <Segmented
          value={value.lineSpacing}
          onChange={(v) => set({ lineSpacing: v })}
          options={LINE_SPACINGS}
          layoutId={`${idPrefix}-lh`}
        />
      </Field>
      <div className="toggle-list">
        <Toggle
          icon={WavesIcon}
          label="Меньше анимаций"
          hint="Спокойный интерфейс без движения — помогает при СДВГ и сенсорной чувствительности"
          checked={value.reduceMotion}
          onChange={(v) => set({ reduceMotion: v })}
        />
        <Toggle
          icon={CircleHalfIcon}
          label="Высокий контраст"
          hint="Более тёмный текст и чёткие границы"
          checked={value.highContrast}
          onChange={(v) => set({ highContrast: v })}
        />
        <Toggle
          icon={BookOpenTextIcon}
          label="Удобное чтение"
          hint="Шрифт Verdana и увеличенные интервалы между буквами — помогает при дислексии"
          checked={value.readableFont}
          onChange={(v) => set({ readableFont: v })}
        />
      </div>
      <div
        className={cx('a11y-preview', value.highContrast && 'is-contrast', value.readableFont && 'is-readable')}
        style={{ fontSize: 16 * scale, lineHeight: lh }}
        aria-label="Предпросмотр"
      >
        <span className="a11y-preview__label">Предпросмотр</span>
        <p>
          Привет! Сегодня занятие в 15:00. Возьми карточки с животными — будем играть и учить новые слова.
        </p>
      </div>
    </div>
  );
}
