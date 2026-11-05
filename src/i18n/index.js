// Языки интерфейса Pingo.
// Тексты в коде пишутся по-русски и служат ключами словаря: t('Настройки') вернёт «Баптаулар»
// на казахском и «Настройки» на русском. Если перевода нет, показывается русский текст.
// Подстановки — в фигурных скобках: t('Привет, {name}!', { name }).
//
// Язык хранится на устройстве. Смена языка перезагружает страницу: справочники (lib/constants.js)
// и форматы дат считаются один раз при загрузке.
import { Fragment, createElement } from 'react';
import kk from './kk';

export const LANGS = [
  { id: 'ru', label: 'Русский', locale: 'ru-RU' },
  { id: 'kk', label: 'Қазақша', locale: 'kk-KZ' },
];
const DICTS = { kk };
const STORAGE_KEY = 'pingo:lang';

function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.some((l) => l.id === saved)) return saved;
  } catch {
    /* приватный режим — берём язык браузера */
  }
  const preferred = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return preferred.some((l) => /^kk\b/i.test(l || '')) ? 'kk' : 'ru';
}

export const lang = detectLang();
export const locale = LANGS.find((l) => l.id === lang).locale;
const dict = DICTS[lang] ?? null;

if (typeof document !== 'undefined') document.documentElement.lang = lang;

const PLACEHOLDER = /\{(\w+)\}/g;

// context — уточнение для слов, которые по-русски пишутся одинаково, а переводятся по-разному:
// t('лет', null, 'возраст') ищет в словаре сначала «возраст|лет» («жас»), затем «лет» («жыл»).
export function t(key, params, context) {
  const text = (context && dict?.[`${context}|${key}`]) || dict?.[key] || key;
  if (!params) return text;
  const rich = Object.values(params).some((v) => v !== null && typeof v === 'object');
  if (!rich) return text.replace(PLACEHOLDER, (m, name) => (name in params ? String(params[name] ?? '') : m));
  // В подстановке React-элемент (например, <strong>): возвращаем список узлов.
  return text
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part, i) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return createElement(Fragment, { key: i }, name && name in params ? params[name] : part);
    });
}

export function setLang(next) {
  if (next === lang || !LANGS.some((l) => l.id === next)) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  window.location.reload();
}
