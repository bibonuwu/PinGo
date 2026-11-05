import { LANGS, lang, setLang } from '../i18n';
import { cx } from '../lib/utils';

// Компактный переключатель языка для страниц до входа (в кабинете язык меняют в «Настройках»).
// Названия языков — на самих языках, их не переводим.
const SHORT = { ru: 'РУС', kk: 'ҚАЗ' };

export function LangSwitch({ className }) {
  return (
    <div className={cx('lang-switch', className)} role="radiogroup" aria-label="Язык / Тіл">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={l.id === lang}
          lang={l.id}
          title={l.label}
          className={cx('lang-switch__item', l.id === lang && 'is-active')}
          onClick={() => setLang(l.id)}
        >
          {SHORT[l.id]}
        </button>
      ))}
    </div>
  );
}
