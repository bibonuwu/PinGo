// Тексты, которые сохраняются в базе и читает другой человек: уведомления и системные сообщения чата.
// Кроме готового текста храним шаблон — ключ словаря и параметры, — и каждый читатель видит его
// на своём языке. Готовый текст остаётся для старых версий приложения.
import { COMPLAINT_REASON_MAP, PROFILE_KINDS } from '../lib/constants';
import { fmtAge, fmtStamp } from '../lib/utils';
import { t } from './index';

// Параметры шаблона: строка или число — как есть; { ts } — дата и время; { age } — возраст;
// { t } — слово из словаря (например, «ребёнок», если имени нет); { label, id } — подпись из справочника.
export function msg(key, params = null) {
  if (!params) return { key };
  const clean = {};
  for (const [k, v] of Object.entries(params)) clean[k] = v ?? '';
  return { key, params: clean };
}

export const isMsg = (v) => v !== null && typeof v === 'object' && typeof v.key === 'string';

const LABELS = {
  complaintReason: (id) => COMPLAINT_REASON_MAP[id]?.label ?? '',
  profileKind: (id) => (PROFILE_KINDS.find((k) => k.id === id)?.label ?? '').toLowerCase(),
};

function resolve(params) {
  if (!params) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && typeof v === 'object') {
      if ('ts' in v) out[k] = fmtStamp(v.ts);
      else if ('age' in v) out[k] = v.age == null ? '' : fmtAge(v.age);
      else if ('t' in v) out[k] = t(v.t);
      else if ('label' in v) out[k] = LABELS[v.label]?.(v.id) ?? '';
      else out[k] = '';
    } else out[k] = v;
  }
  return out;
}

export const renderMsg = (m) => t(m.key, resolve(m.params));

// Готовый текст для сохранения рядом с шаблоном.
export const plainText = (v) => (isMsg(v) ? renderMsg(v) : v);

// Текст для показа. У записей без шаблона (созданных до перевода) пробуем перевести сам текст —
// так переводятся постоянные заголовки вроде «Новый запрос на занятие». Текст, который написал
// человек (рассылки, письма модератора), не трогаем: translate = false.
export function storedText(text, template, { translate = true } = {}) {
  if (isMsg(template)) return renderMsg(template);
  return translate && text ? t(text) : text;
}

// Уведомления, текст которых написал человек.
const AUTHORED = new Set(['announcement', 'support_message']);

export const notificationTitle = (n) => storedText(n.title, n.i18n?.title, { translate: !AUTHORED.has(n.type) });
export const notificationBody = (n) => storedText(n.body, n.i18n?.body, { translate: !AUTHORED.has(n.type) });

// Подпись отзыва хранится по-русски: «Имя, родитель».
export function reviewAuthor(name = '') {
  const m = /^(.*), родитель$/.exec(name);
  return m ? t('{name}, родитель', { name: m[1] }) : name;
}
