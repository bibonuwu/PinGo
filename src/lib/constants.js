// Справочники предметной области Pingo.
import { t } from '../i18n';

export const APP_VERSION = '0.1.0';
export const SLOGAN = 'Support for every child';

// Модераторы Pingo — только эти почты (подтверждённые). Тот же список — в firestore.rules, функция isAdmin().
export const ADMIN_EMAILS = ['toryyy0325@gmail.com', 'aibekabeken47@gmail.com'];
export const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || '').trim().toLowerCase());

// Видеокомната открывается за 15 минут до начала и закрывается через 15 минут после конца.
export const ROOM_OPENS_BEFORE_MIN = 15;
export const ROOM_CLOSES_AFTER_MIN = 15;
// Записаться можно не позже чем за час до начала и не дальше, чем на 3 недели вперёд.
export const BOOKING_LEAD_MIN = 60;
export const BOOKING_HORIZON_DAYS = 21;
export const SESSION_DURATIONS = [30, 45, 60];

export const AVATARS = [
  { id: 'pirate', label: t('Пират'), color: '#4CB6AC' },
  { id: 'traveler', label: t('Путешественник'), color: '#A5D7EE' },
  { id: 'raincoat', label: t('Дождевичок'), color: '#F2963F' },
  { id: 'chef', label: t('Повар'), color: '#A4CDA8' },
  { id: 'ballerina', label: t('Балерина'), color: '#EF9AB9' },
  { id: 'wizard', label: t('Волшебник'), color: '#9C6AA9' },
  { id: 'farmer', label: t('Фермер'), color: '#EE6457' },
  { id: 'artist', label: t('Художник'), color: '#F7E7CB' },
  { id: 'hero', label: t('Супергерой'), color: '#F8C55D' },
];
export const AVATAR_MAP = Object.fromEntries(AVATARS.map((a) => [a.id, a]));
export const avatarSrc = (id) => `/avatars/${id}.png`;

// Потребности ребёнка. Первые шесть — из ТЗ, остальные — из концепции (адаптивная система).
export const NEEDS = [
  { id: 'autism', label: t('Аутизм (РАС)') },
  { id: 'adhd', label: t('СДВГ') },
  { id: 'speech_delay', label: t('Задержка речи') },
  { id: 'learning', label: t('Трудности обучения') },
  { id: 'motor', label: t('Моторика') },
  { id: 'social', label: t('Социальные навыки') },
  { id: 'dyslexia', label: t('Дислексия') },
  { id: 'hearing', label: t('Нарушение слуха') },
  { id: 'vision', label: t('Нарушение зрения') },
  { id: 'other', label: t('Другое') },
];
export const NEED_MAP = Object.fromEntries(NEEDS.map((n) => [n.id, n]));

export const LEARNING_STYLES = [
  { id: 'visual', label: t('Визуальный'), hint: t('Картинки, схемы, карточки и видео') },
  { id: 'auditory', label: t('Аудиальный'), hint: t('Слушать, проговаривать, песенки') },
  { id: 'kinesthetic', label: t('Через движение'), hint: t('Руками, в действии, с предметами') },
  { id: 'play', label: t('Игровой'), hint: t('Через игру, сказки и персонажей') },
  { id: 'structured', label: t('Пошаговый'), hint: t('Чёткий план, повторение, предсказуемость') },
];
export const LEARNING_STYLE_MAP = Object.fromEntries(LEARNING_STYLES.map((s) => [s.id, s]));

// Фильтры каталога. «Волонтёры» — это тип анкеты, остальные — группы специализаций.
export const CATEGORIES = [
  { id: 'speech', label: t('Логопедия'), color: '#8B5CF6' },
  { id: 'tutoring', label: t('Репетиторство'), color: '#FFB800' },
  { id: 'psychology', label: t('Психология'), color: '#3B82F6' },
  { id: 'ot', label: t('Эрготерапия'), color: '#22C55E' },
  { id: 'volunteers', label: t('Волонтёры'), color: '#F97316' },
];
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// 12 специализаций анкеты специалиста/волонтёра.
export const SPECIALIZATIONS = [
  { id: 'speech', label: t('Логопедия'), category: 'speech' },
  { id: 'alt_comm', label: t('Альтернативная коммуникация'), category: 'speech' },
  { id: 'special_ed', label: t('Дефектология'), category: 'tutoring' },
  { id: 'primary', label: t('Подготовка к школе и начальная школа'), category: 'tutoring' },
  { id: 'subjects', label: t('Школьные предметы'), category: 'tutoring' },
  { id: 'reading', label: t('Чтение и письмо'), category: 'tutoring' },
  { id: 'child_psych', label: t('Детская психология'), category: 'psychology' },
  { id: 'neuropsych', label: t('Нейропсихология'), category: 'psychology' },
  { id: 'aba', label: t('АВА-терапия'), category: 'psychology' },
  { id: 'social', label: t('Социальные навыки'), category: 'psychology' },
  { id: 'ot', label: t('Эрготерапия'), category: 'ot' },
  { id: 'motor', label: t('Моторика и сенсорная интеграция'), category: 'ot' },
];
export const SPECIALIZATION_MAP = Object.fromEntries(SPECIALIZATIONS.map((s) => [s.id, s]));
export const MAX_SPECIALIZATIONS = 6;

// Какие специализации помогают при каждой потребности — основа подбора.
export const NEED_SPECIALIZATIONS = {
  autism: ['aba', 'alt_comm', 'speech', 'social', 'motor', 'child_psych'],
  adhd: ['neuropsych', 'child_psych', 'primary', 'subjects'],
  speech_delay: ['speech', 'alt_comm', 'special_ed'],
  learning: ['special_ed', 'primary', 'reading', 'subjects', 'neuropsych'],
  motor: ['ot', 'motor'],
  social: ['social', 'child_psych', 'aba'],
  dyslexia: ['reading', 'special_ed', 'neuropsych'],
  hearing: ['special_ed', 'speech', 'alt_comm'],
  vision: ['special_ed', 'ot'],
  other: [],
};

export const PROFILE_KINDS = [
  {
    id: 'specialist',
    label: t('Специалист'),
    hint: t('Есть профильное образование, ведёте занятия профессионально'),
  },
  {
    id: 'volunteer',
    label: t('Волонтёр'),
    hint: t('Помогаете безвозмездно: студенты, педагоги, наставники'),
  },
];

export const FORMATS = [
  { id: 'online', label: t('Онлайн'), hint: t('Видеозанятие в Pingo') },
  { id: 'offline', label: t('Очно'), hint: t('Встреча лично, адрес согласуете в чате') },
];
export const FORMAT_MAP = Object.fromEntries(FORMATS.map((f) => [f.id, f]));

export const LANGUAGES = [
  { id: 'ru', label: t('Русский') },
  { id: 'kk', label: t('Казахский') },
  { id: 'en', label: t('Английский') },
];
export const LANGUAGE_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));

export const WEEKDAYS = [
  { id: 1, short: t('Пн'), label: t('Понедельник') },
  { id: 2, short: t('Вт'), label: t('Вторник') },
  { id: 3, short: t('Ср'), label: t('Среда') },
  { id: 4, short: t('Чт'), label: t('Четверг') },
  { id: 5, short: t('Пт'), label: t('Пятница') },
  { id: 6, short: t('Сб'), label: t('Суббота') },
  { id: 0, short: t('Вс'), label: t('Воскресенье') },
];
export const WEEKDAY_MAP = Object.fromEntries(WEEKDAYS.map((w) => [w.id, w]));

// ---------- Статусы ----------

export const BOOKING_STATUS = {
  pending: { label: t('Ожидает подтверждения'), short: t('Ожидает'), tone: 'warning' },
  confirmed: { label: t('Подтверждено'), short: t('Подтверждено'), tone: 'success' },
  declined: { label: t('Отклонено'), short: t('Отклонено'), tone: 'danger' },
  cancelled: { label: t('Отменено'), short: t('Отменено'), tone: 'muted' },
  // производные статусы (не хранятся в БД)
  completed: { label: t('Занятие проведено'), short: t('Проведено'), tone: 'info' },
  expired: { label: t('Не подтверждено вовремя'), short: t('Истёк срок'), tone: 'muted' },
};

export const PROFILE_STATUS = {
  draft: { label: t('Черновик'), tone: 'muted' },
  pending: { label: t('На модерации'), tone: 'warning' },
  approved: { label: t('Одобрена'), tone: 'success' },
  rejected: { label: t('Отклонена'), tone: 'danger' },
};

// ---------- Сертификаты и рассылки модератора ----------

export const CERTIFICATE_TYPES = [
  { id: 'volunteer_month', label: t('Волонтёр месяца'), text: t('за самоотверженную помощь детям и их семьям'), color: '#F97316' },
  { id: 'top_rated', label: t('Высокий рейтинг'), text: t('за высокие оценки родителей и бережную работу с детьми'), color: '#F4C600' },
  { id: 'hours', label: t('Часы добрых дел'), text: t('за время, подаренное детям на платформе Pingo'), color: '#22C55E' },
  { id: 'gratitude', label: t('Благодарность'), text: t('за вклад в поддержку детей с особыми потребностями'), color: '#3B82F6' },
  { id: 'custom', label: t('Свой сертификат'), text: '', color: '#8B5CF6' },
];
export const CERTIFICATE_MAP = Object.fromEntries(CERTIFICATE_TYPES.map((c) => [c.id, c]));

export const BROADCAST_AUDIENCES = [
  { id: 'all', label: t('Все') },
  { id: 'parents', label: t('Родители') },
  { id: 'specialists', label: t('Специалисты и волонтёры') },
  { id: 'volunteers', label: t('Только волонтёры') },
];
export const BROADCAST_AUDIENCE_MAP = Object.fromEntries(BROADCAST_AUDIENCES.map((a) => [a.id, a]));

// ---------- Доступность ----------

export const TEXT_SIZES = [
  { id: 'normal', label: t('Обычный'), scale: 1 },
  { id: 'large', label: t('Крупный'), scale: 1.125 },
  { id: 'xlarge', label: t('Очень крупный'), scale: 1.25 },
];
export const LINE_SPACINGS = [
  { id: 'normal', label: t('Обычный'), value: 1.5 },
  { id: 'relaxed', label: t('Больше'), value: 1.75 },
  { id: 'loose', label: t('Максимум'), value: 2 },
];
export const DEFAULT_A11Y = {
  textSize: 'normal',
  lineSpacing: 'normal',
  reduceMotion: false,
  highContrast: false,
  readableFont: false,
};

// Автоподбор настроек по особенностям ребёнка (раздел «Адаптивная образовательная система»).
export function suggestAccessibility(needs = []) {
  const s = { ...DEFAULT_A11Y };
  const has = (n) => needs.includes(n);
  if (has('adhd') || has('autism')) s.reduceMotion = true;
  if (has('dyslexia')) {
    s.lineSpacing = 'relaxed';
    s.readableFont = true;
  } else if (has('learning')) {
    s.lineSpacing = 'relaxed';
  }
  if (has('motor')) s.textSize = 'large';
  if (has('vision')) {
    s.textSize = 'xlarge';
    s.highContrast = true;
  }
  return s;
}

export function describeAccessibility(a = DEFAULT_A11Y) {
  const out = [];
  if (a.textSize !== 'normal') out.push(a.textSize === 'large' ? t('крупный текст') : t('очень крупный текст'));
  if (a.lineSpacing !== 'normal') out.push(t('увеличенный межстрочный интервал'));
  if (a.reduceMotion) out.push(t('меньше анимаций'));
  if (a.highContrast) out.push(t('высокий контраст'));
  if (a.readableFont) out.push(t('шрифт для удобного чтения'));
  return out;
}

// ---------- Шаблоны причин ----------

export const REJECT_TEMPLATES = [
  t('Расскажите подробнее об опыте работы с детьми.'),
  t('Нужны документы, подтверждающие квалификацию.'),
  t('Описание не соответствует правилам платформы.'),
  t('Указанные специализации не подтверждаются опытом.'),
];
export const DECLINE_TEMPLATES = [
  t('В это время я уже занят(а).'),
  t('Не работаю с таким запросом — подскажу коллегу в чате.'),
  t('Возраст ребёнка вне моей практики.'),
];
export const CANCEL_TEMPLATES = [t('Ребёнок заболел.'), t('Изменились планы.'), t('Нашли другое время.')];
export const COMPLAINT_REASONS = [
  { id: 'behavior', label: t('Неуважительное поведение') },
  { id: 'safety', label: t('Угроза безопасности ребёнка') },
  { id: 'fraud', label: t('Мошенничество или спам') },
  { id: 'fake', label: t('Недостоверная анкета') },
  { id: 'other', label: t('Другое') },
];
export const COMPLAINT_REASON_MAP = Object.fromEntries(COMPLAINT_REASONS.map((r) => [r.id, r]));

// ---------- Обучение волонтёров и специалистов (из концепции) ----------

export const TRAINING_MODULES = [
  {
    id: 'inclusion',
    title: t('Основы инклюзивного образования'),
    minutes: 4,
    points: [
      t('Каждый ребёнок учится в своём темпе — сравнивайте его только с ним самим.'),
      t('Опирайтесь на сильные стороны и интересы ребёнка, а не на диагноз.'),
      t('Делите задания на маленькие шаги и отмечайте каждый успех.'),
      t('Родители — ваши главные союзники: обсуждайте цели и договорённости вместе.'),
    ],
  },
  {
    id: 'ethics',
    title: t('Этика общения'),
    minutes: 3,
    points: [
      t('Говорите с ребёнком, а не о нём в его присутствии.'),
      t('Используйте простые, короткие и доброжелательные формулировки.'),
      t('Не обещайте результатов, которые не можете гарантировать.'),
      t('Сохраняйте конфиденциальность: не обсуждайте детей и семьи с третьими лицами.'),
    ],
  },
  {
    id: 'safety',
    title: t('Безопасность детей'),
    minutes: 5,
    points: [
      t('Общайтесь с семьёй только внутри Pingo — не переводите ребёнка в личные мессенджеры.'),
      t('Онлайн-занятие проходит при участии или доступности взрослого.'),
      t('Не делайте скриншоты и записи без письменного согласия родителей.'),
      t('Если видите признаки опасности для ребёнка — сразу сообщите через «Пожаловаться» или в поддержку.'),
    ],
  },
  {
    id: 'conditions',
    title: t('Особенности нарушений развития'),
    minutes: 6,
    points: [
      t('РАС: предсказуемость, визуальные подсказки, бережное отношение к сенсорной чувствительности.'),
      t('СДВГ: короткие блоки по 5–10 минут, движение и регулярные перерывы.'),
      t('Задержка речи: моделируйте речь, давайте время на ответ, используйте жесты и карточки.'),
      t('Дислексия и трудности обучения: крупный шрифт, интервалы, многоканальная подача.'),
    ],
  },
  {
    id: 'sessions',
    title: t('Правила проведения занятий'),
    minutes: 3,
    points: [
      t('Подтверждайте или отклоняйте запросы вовремя — семья ждёт ответа.'),
      t('Входите в видеокомнату заранее: она открывается за 15 минут до начала.'),
      t('После занятия заполните короткий отчёт: что делали, успехи и рекомендации.'),
      t('Если не можете провести занятие — отмените его заранее и предупредите в чате.'),
    ],
  },
];
