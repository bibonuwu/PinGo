// Справочники предметной области Pingo.

export const APP_VERSION = '0.1.0';
export const SLOGAN = 'Support for every child';

// Видеокомната открывается за 15 минут до начала и закрывается через 15 минут после конца.
export const ROOM_OPENS_BEFORE_MIN = 15;
export const ROOM_CLOSES_AFTER_MIN = 15;
// Записаться можно не позже чем за час до начала и не дальше, чем на 3 недели вперёд.
export const BOOKING_LEAD_MIN = 60;
export const BOOKING_HORIZON_DAYS = 21;
export const SESSION_DURATIONS = [30, 45, 60];

export const AVATARS = [
  { id: 'pirate', label: 'Пират', color: '#4CB6AC' },
  { id: 'traveler', label: 'Путешественник', color: '#A5D7EE' },
  { id: 'raincoat', label: 'Дождевичок', color: '#F2963F' },
  { id: 'chef', label: 'Повар', color: '#A4CDA8' },
  { id: 'ballerina', label: 'Балерина', color: '#EF9AB9' },
  { id: 'wizard', label: 'Волшебник', color: '#9C6AA9' },
  { id: 'farmer', label: 'Фермер', color: '#EE6457' },
  { id: 'artist', label: 'Художник', color: '#F7E7CB' },
  { id: 'hero', label: 'Супергерой', color: '#F8C55D' },
];
export const AVATAR_MAP = Object.fromEntries(AVATARS.map((a) => [a.id, a]));
export const avatarSrc = (id) => `/avatars/${id}.png`;

// Потребности ребёнка. Первые шесть — из ТЗ, остальные — из концепции (адаптивная система).
export const NEEDS = [
  { id: 'autism', label: 'Аутизм (РАС)' },
  { id: 'adhd', label: 'СДВГ' },
  { id: 'speech_delay', label: 'Задержка речи' },
  { id: 'learning', label: 'Трудности обучения' },
  { id: 'motor', label: 'Моторика' },
  { id: 'social', label: 'Социальные навыки' },
  { id: 'dyslexia', label: 'Дислексия' },
  { id: 'hearing', label: 'Нарушение слуха' },
  { id: 'vision', label: 'Нарушение зрения' },
  { id: 'other', label: 'Другое' },
];
export const NEED_MAP = Object.fromEntries(NEEDS.map((n) => [n.id, n]));

export const LEARNING_STYLES = [
  { id: 'visual', label: 'Визуальный', hint: 'Картинки, схемы, карточки и видео' },
  { id: 'auditory', label: 'Аудиальный', hint: 'Слушать, проговаривать, песенки' },
  { id: 'kinesthetic', label: 'Через движение', hint: 'Руками, в действии, с предметами' },
  { id: 'play', label: 'Игровой', hint: 'Через игру, сказки и персонажей' },
  { id: 'structured', label: 'Пошаговый', hint: 'Чёткий план, повторение, предсказуемость' },
];
export const LEARNING_STYLE_MAP = Object.fromEntries(LEARNING_STYLES.map((s) => [s.id, s]));

// Фильтры каталога. «Волонтёры» — это тип анкеты, остальные — группы специализаций.
export const CATEGORIES = [
  { id: 'speech', label: 'Логопедия', color: '#8B5CF6' },
  { id: 'tutoring', label: 'Репетиторство', color: '#FFB800' },
  { id: 'psychology', label: 'Психология', color: '#3B82F6' },
  { id: 'ot', label: 'Эрготерапия', color: '#22C55E' },
  { id: 'volunteers', label: 'Волонтёры', color: '#F97316' },
];
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// 12 специализаций анкеты специалиста/волонтёра.
export const SPECIALIZATIONS = [
  { id: 'speech', label: 'Логопедия', category: 'speech' },
  { id: 'alt_comm', label: 'Альтернативная коммуникация', category: 'speech' },
  { id: 'special_ed', label: 'Дефектология', category: 'tutoring' },
  { id: 'primary', label: 'Подготовка к школе и начальная школа', category: 'tutoring' },
  { id: 'subjects', label: 'Школьные предметы', category: 'tutoring' },
  { id: 'reading', label: 'Чтение и письмо', category: 'tutoring' },
  { id: 'child_psych', label: 'Детская психология', category: 'psychology' },
  { id: 'neuropsych', label: 'Нейропсихология', category: 'psychology' },
  { id: 'aba', label: 'АВА-терапия', category: 'psychology' },
  { id: 'social', label: 'Социальные навыки', category: 'psychology' },
  { id: 'ot', label: 'Эрготерапия', category: 'ot' },
  { id: 'motor', label: 'Моторика и сенсорная интеграция', category: 'ot' },
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
    label: 'Специалист',
    hint: 'Есть профильное образование, ведёте занятия профессионально',
  },
  {
    id: 'volunteer',
    label: 'Волонтёр',
    hint: 'Помогаете безвозмездно: студенты, педагоги, наставники',
  },
];

export const FORMATS = [
  { id: 'online', label: 'Онлайн', hint: 'Видеозанятие в Pingo' },
  { id: 'offline', label: 'Очно', hint: 'Встреча лично, адрес согласуете в чате' },
];
export const FORMAT_MAP = Object.fromEntries(FORMATS.map((f) => [f.id, f]));

export const LANGUAGES = [
  { id: 'ru', label: 'Русский' },
  { id: 'kk', label: 'Казахский' },
  { id: 'en', label: 'Английский' },
];
export const LANGUAGE_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));

export const WEEKDAYS = [
  { id: 1, short: 'Пн', label: 'Понедельник' },
  { id: 2, short: 'Вт', label: 'Вторник' },
  { id: 3, short: 'Ср', label: 'Среда' },
  { id: 4, short: 'Чт', label: 'Четверг' },
  { id: 5, short: 'Пт', label: 'Пятница' },
  { id: 6, short: 'Сб', label: 'Суббота' },
  { id: 0, short: 'Вс', label: 'Воскресенье' },
];
export const WEEKDAY_MAP = Object.fromEntries(WEEKDAYS.map((w) => [w.id, w]));

// ---------- Статусы ----------

export const BOOKING_STATUS = {
  pending: { label: 'Ожидает подтверждения', short: 'Ожидает', tone: 'warning' },
  confirmed: { label: 'Подтверждено', short: 'Подтверждено', tone: 'success' },
  declined: { label: 'Отклонено', short: 'Отклонено', tone: 'danger' },
  cancelled: { label: 'Отменено', short: 'Отменено', tone: 'muted' },
  // производные статусы (не хранятся в БД)
  completed: { label: 'Занятие проведено', short: 'Проведено', tone: 'info' },
  expired: { label: 'Не подтверждено вовремя', short: 'Истёк срок', tone: 'muted' },
};

export const PROFILE_STATUS = {
  draft: { label: 'Черновик', tone: 'muted' },
  pending: { label: 'На модерации', tone: 'warning' },
  approved: { label: 'Одобрена', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' },
};

// ---------- Доступность ----------

export const TEXT_SIZES = [
  { id: 'normal', label: 'Обычный', scale: 1 },
  { id: 'large', label: 'Крупный', scale: 1.125 },
  { id: 'xlarge', label: 'Очень крупный', scale: 1.25 },
];
export const LINE_SPACINGS = [
  { id: 'normal', label: 'Обычный', value: 1.5 },
  { id: 'relaxed', label: 'Увеличенный', value: 1.75 },
  { id: 'loose', label: 'Максимальный', value: 2 },
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
  if (a.textSize !== 'normal') out.push(a.textSize === 'large' ? 'крупный текст' : 'очень крупный текст');
  if (a.lineSpacing !== 'normal') out.push('увеличенный межстрочный интервал');
  if (a.reduceMotion) out.push('меньше анимаций');
  if (a.highContrast) out.push('высокий контраст');
  if (a.readableFont) out.push('шрифт для удобного чтения');
  return out;
}

// ---------- Шаблоны причин ----------

export const REJECT_TEMPLATES = [
  'Расскажите подробнее об опыте работы с детьми.',
  'Нужны документы, подтверждающие квалификацию.',
  'Описание не соответствует правилам платформы.',
  'Указанные специализации не подтверждаются опытом.',
];
export const DECLINE_TEMPLATES = [
  'В это время я уже занят(а).',
  'Не работаю с таким запросом — подскажу коллегу в чате.',
  'Возраст ребёнка вне моей практики.',
];
export const CANCEL_TEMPLATES = ['Ребёнок заболел.', 'Изменились планы.', 'Нашли другое время.'];
export const COMPLAINT_REASONS = [
  { id: 'behavior', label: 'Неуважительное поведение' },
  { id: 'safety', label: 'Угроза безопасности ребёнка' },
  { id: 'fraud', label: 'Мошенничество или спам' },
  { id: 'fake', label: 'Недостоверная анкета' },
  { id: 'other', label: 'Другое' },
];
export const COMPLAINT_REASON_MAP = Object.fromEntries(COMPLAINT_REASONS.map((r) => [r.id, r]));

// ---------- Обучение волонтёров и специалистов (из концепции) ----------

export const TRAINING_MODULES = [
  {
    id: 'inclusion',
    title: 'Основы инклюзивного образования',
    minutes: 4,
    points: [
      'Каждый ребёнок учится в своём темпе — сравнивайте его только с ним самим.',
      'Опирайтесь на сильные стороны и интересы ребёнка, а не на диагноз.',
      'Делите задания на маленькие шаги и отмечайте каждый успех.',
      'Родители — ваши главные союзники: обсуждайте цели и договорённости вместе.',
    ],
  },
  {
    id: 'ethics',
    title: 'Этика общения',
    minutes: 3,
    points: [
      'Говорите с ребёнком, а не о нём в его присутствии.',
      'Используйте простые, короткие и доброжелательные формулировки.',
      'Не обещайте результатов, которые не можете гарантировать.',
      'Сохраняйте конфиденциальность: не обсуждайте детей и семьи с третьими лицами.',
    ],
  },
  {
    id: 'safety',
    title: 'Безопасность детей',
    minutes: 5,
    points: [
      'Общайтесь с семьёй только внутри Pingo — не переводите ребёнка в личные мессенджеры.',
      'Онлайн-занятие проходит при участии или доступности взрослого.',
      'Не делайте скриншоты и записи без письменного согласия родителей.',
      'Если видите признаки опасности для ребёнка — сразу сообщите через «Пожаловаться» или в поддержку.',
    ],
  },
  {
    id: 'conditions',
    title: 'Особенности нарушений развития',
    minutes: 6,
    points: [
      'РАС: предсказуемость, визуальные подсказки, бережное отношение к сенсорной чувствительности.',
      'СДВГ: короткие блоки по 5–10 минут, движение и регулярные перерывы.',
      'Задержка речи: моделируйте речь, давайте время на ответ, используйте жесты и карточки.',
      'Дислексия и трудности обучения: крупный шрифт, интервалы, многоканальная подача.',
    ],
  },
  {
    id: 'sessions',
    title: 'Правила проведения занятий',
    minutes: 3,
    points: [
      'Подтверждайте или отклоняйте запросы вовремя — семья ждёт ответа.',
      'Входите в видеокомнату заранее: она открывается за 15 минут до начала.',
      'После занятия заполните короткий отчёт: что делали, успехи и рекомендации.',
      'Если не можете провести занятие — отмените его заранее и предупредите в чате.',
    ],
  },
];
