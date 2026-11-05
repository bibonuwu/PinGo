// Общие утилиты: id, классы, даты и форматирование на языке интерфейса.
import { locale, t } from '../i18n';

// crypto.randomUUID недоступен вне https/localhost (например, при тесте с телефона по LAN),
// а getRandomValues работает везде.
export function uid() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function pluralize(n, forms) {
  return `${n} ${plural(n, forms)}`;
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || name;
}

// ---------- Даты ----------

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function startOfDay(input) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(input, n) {
  const d = new Date(input);
  d.setDate(d.getDate() + n);
  return d;
}

// 'YYYY-MM-DD' в локальном времени
export function toDateKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(total) {
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function atMinutes(dayInput, minutes) {
  const d = startOfDay(dayInput);
  d.setMinutes(minutes);
  return d.getTime();
}

export function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b);
}

// Chrome и Edge поставляются без казахских названий месяцев и дней недели (Intl выдаёт «M11 6» и «Fri»),
// поэтому по-казахски дату собираем сами: «6 қараша», «жм, 6 қараша», «6 қараша 2026 ж.».
const KK_MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
const KK_MONTHS_SHORT = ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'];
const KK_WEEKDAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
const KK_WEEKDAYS_SHORT = ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сн'];

const intl = (options) => {
  const f = new Intl.DateTimeFormat(locale, options);
  return (ts) => f.format(ts);
};
const withDate = (fn) => (ts) => fn(new Date(ts));
const isKk = locale.startsWith('kk');

export const fmtTime = withDate((d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
export const fmtDate = isKk ? withDate((d) => `${d.getDate()} ${KK_MONTHS[d.getMonth()]}`) : intl({ day: 'numeric', month: 'long' });
export const fmtDateYear = isKk
  ? withDate((d) => `${d.getDate()} ${KK_MONTHS[d.getMonth()]} ${d.getFullYear()} ж.`)
  : intl({ day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = intl({ day: 'numeric', month: 'short' });
export const fmtShortDate = isKk ? withDate((d) => `${d.getDate()} ${KK_MONTHS_SHORT[d.getMonth()]}`) : (ts) => shortDate(ts).replace('.', '');
export const fmtWeekday = isKk ? withDate((d) => KK_WEEKDAYS_SHORT[d.getDay()]) : intl({ weekday: 'short' });
export const fmtWeekdayLong = isKk ? withDate((d) => KK_WEEKDAYS[d.getDay()]) : intl({ weekday: 'long' });

export function capitalize(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// «Сегодня», «Завтра», «Вчера» или «пт, 14 ноября»
export function fmtDay(ts, now = Date.now()) {
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / DAY);
  if (diff === 0) return t('Сегодня');
  if (diff === 1) return t('Завтра');
  if (diff === -1) return t('Вчера');
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return `${fmtWeekday(ts)}, ${sameYear ? fmtDate(ts) : fmtDateYear(ts)}`;
}

export function fmtDayTime(ts, now = Date.now()) {
  return `${fmtDay(ts, now)}, ${fmtTime(ts)}`;
}

// Абсолютная метка для текстов, которые сохраняются (системные сообщения, уведомления):
// «пт, 7 ноября, 10:00» не устареет, в отличие от «Завтра, 10:00».
export function fmtStamp(ts) {
  return `${fmtWeekday(ts)}, ${fmtDate(ts)}, ${fmtTime(ts)}`;
}

export function fmtRange(start, end) {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}

// Для лент сообщений и уведомлений
export function fmtAgo(ts, now = Date.now()) {
  const diff = now - ts;
  if (diff < MINUTE) return t('только что');
  if (diff < HOUR) return t('{floor} мин назад', { floor: Math.floor(diff / MINUTE) });
  if (isSameDay(ts, now)) return fmtTime(ts);
  if (diff < 2 * DAY && isSameDay(ts, now - DAY)) return t('вчера, {fmtTime}', { fmtTime: fmtTime(ts) });
  return fmtShortDate(ts);
}

export function fmtCountdown(ms) {
  if (ms <= 0) return '0:00';
  const total = Math.ceil(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return t('{d} д {h} ч', { d, h });
  if (h > 0) return t('{h} ч {pad2} мин', { h, pad2: pad2(m) });
  return `${m}:${pad2(s)}`;
}

export function fmtDuration(minutes) {
  if (minutes < 60) return t('{minutes} мин', { minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t('{h} ч {m} мин', { h, m }) : t('{h} ч', { h });
}

export function fmtHours(minutes) {
  const h = minutes / 60;
  return t('{p0} ч', { p0: Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',') });
}

// ---------- Возраст ----------

export function ageFromBirthDate(birthDate, now = Date.now()) {
  if (!birthDate) return null;
  const b = parseDateKey(birthDate);
  const n = new Date(now);
  let age = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age -= 1;
  return age;
}

export function fmtAge(age) {
  if (age == null) return '';
  return pluralize(age, [t('год', null, 'возраст'), t('года', null, 'возраст'), t('лет', null, 'возраст')]);
}

export function birthDateBounds(now = Date.now()) {
  const today = new Date(now);
  // от 1 года (родился не позже, чем год назад) до 18 лет включительно
  const max = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const min = new Date(today.getFullYear() - 19, today.getMonth(), today.getDate() + 1);
  return { min: toDateKey(min), max: toDateKey(max) };
}

// ---------- Разное ----------

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
}

export function downloadFile(name, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fmtBytes(n) {
  if (n < 1024) return t('{n} Б', { n });
  if (n < 1024 * 1024) return t('{round} КБ', { round: Math.round(n / 1024) });
  return t('{replace} МБ', { replace: (n / 1024 / 1024).toFixed(1).replace('.', ',') });
}

export const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим — не критично */
    }
  },
};
