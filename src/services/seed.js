import { db } from '../lib/db';
import { DEFAULT_A11Y, TRAINING_MODULES } from '../lib/constants';
import { generateSlots } from '../lib/slots';
import { DAY, HOUR, MINUTE, addDays, atMinutes, fmtStamp, startOfDay, toDateKey, uid } from '../lib/utils';
import { buildUser } from './auth';
import { conversationIdFor } from './chat';
import { emptyProfileData, newProfile } from './profiles';

// Демо-данные создаются один раз на устройстве. Всё хранится локально в IndexedDB.
const SEED_VERSION = 1;
export const DEMO_PASSWORD = 'pingo123';
export const DEMO_ACCOUNTS = {
  parent: 'demo@pingo.app',
  specialist: 'anna@pingo.app',
  admin: 'admin@pingo.app',
};

const ALL_TRAINING = TRAINING_MODULES.map((m) => m.id);
const AGREED = { truth: true, safety: true };

const APPROVED = [
  {
    key: 'anna',
    name: 'Анна Петрова',
    email: 'anna@pingo.app',
    avatar: 'ballerina',
    session: 45,
    schedule: [
      [1, '10:00', '14:00'],
      [3, '10:00', '14:00'],
      [5, '10:00', '14:00'],
      [2, '15:00', '19:00'],
      [4, '15:00', '19:00'],
    ],
    data: {
      kind: 'specialist',
      title: 'Логопед-дефектолог: запуск речи и альтернативная коммуникация',
      description:
        'Помогаю детям с задержкой речевого развития и РАС заговорить или найти свой способ общаться. Работаю мягко, через игру и интересы ребёнка: карточки PECS, визуальное расписание, сенсорные паузы. На первом занятии знакомимся и вместе с родителями составляем план на месяц.',
      experienceYears: 8,
      experienceText:
        'КазНПУ им. Абая, дефектология. 6 лет в центре ранней помощи, частная практика с 2020 года. Курсы: PECS (уровень 1), сенсорная интеграция в логопедии.',
      specializations: ['speech', 'alt_comm', 'special_ed'],
      ageMin: 2,
      ageMax: 10,
      formats: ['online', 'offline'],
      city: 'Алматы',
      languages: ['ru', 'kk'],
    },
  },
  {
    key: 'elena',
    name: 'Елена Смирнова',
    email: 'elena@demo.pingo.app',
    avatar: 'farmer',
    session: 60,
    schedule: [1, 2, 3, 4, 5].map((d) => [d, '09:00', '12:00']),
    data: {
      kind: 'specialist',
      title: 'Детский психолог: эмоции, поведение и социальные навыки',
      description:
        'Работаю с тревожностью, вспышками гнева и трудностями в общении. Помогаю ребёнку понять свои эмоции, а родителям — найти спокойные способы реагировать. Использую игровую терапию и элементы ABA. После каждой встречи даю рекомендации для занятий дома.',
      experienceYears: 12,
      experienceText:
        'МГУ, клиническая психология. 12 лет практики, из них 7 — с детьми с РАС и СДВГ. Супервизор программы социальной адаптации.',
      specializations: ['child_psych', 'social', 'aba'],
      ageMin: 3,
      ageMax: 16,
      formats: ['online'],
      city: '',
      languages: ['ru'],
    },
  },
  {
    key: 'sergey',
    name: 'Сергей Ким',
    email: 'sergey@demo.pingo.app',
    avatar: 'pirate',
    session: 45,
    schedule: [
      [2, '10:00', '16:00'],
      [4, '10:00', '16:00'],
      [6, '10:00', '16:00'],
    ],
    data: {
      kind: 'specialist',
      title: 'Эрготерапевт: самообслуживание, мелкая моторика, сенсорика',
      description:
        'Учу детей бытовым навыкам: одеваться, есть ложкой, держать карандаш. Подбираю упражнения на сенсорную интеграцию и помогаю адаптировать пространство дома. Занятия похожи на игру, но у каждого упражнения есть цель.',
      experienceYears: 6,
      experienceText:
        'Эрготерапевт, 6 лет в реабилитационном центре. Сертификат по сенсорной интеграции по методу Айрес.',
      specializations: ['ot', 'motor'],
      ageMin: 2,
      ageMax: 12,
      formats: ['online', 'offline'],
      city: 'Алматы',
      languages: ['ru', 'en'],
    },
  },
  {
    key: 'dmitry',
    name: 'Дмитрий Козлов',
    email: 'dmitry@demo.pingo.app',
    avatar: 'wizard',
    session: 60,
    schedule: [
      [1, '16:00', '20:00'],
      [3, '16:00', '20:00'],
      [6, '10:00', '13:00'],
    ],
    data: {
      kind: 'specialist',
      title: 'Нейропсихолог: внимание, память и учебные навыки',
      description:
        'Провожу нейропсихологическую диагностику и коррекционные занятия для детей с СДВГ и трудностями обучения. Тренируем внимание, планирование и самоконтроль через двигательные и настольные задания. Помогаю наладить подготовку уроков без слёз.',
      experienceYears: 10,
      experienceText: 'СПбГУ, нейропсихология. 10 лет в частной практике, автор программы «Внимание по шагам».',
      specializations: ['neuropsych', 'reading', 'primary'],
      ageMin: 5,
      ageMax: 14,
      formats: ['online'],
      city: '',
      languages: ['ru'],
    },
  },
  {
    key: 'maria',
    name: 'Мария Иванова',
    email: 'maria@demo.pingo.app',
    avatar: 'artist',
    session: 45,
    schedule: [1, 2, 3, 4].map((d) => [d, '14:00', '18:00']),
    data: {
      kind: 'specialist',
      title: 'Дефектолог и учитель начальных классов',
      description:
        'Готовлю к школе и сопровождаю в 1–4 классах детей с трудностями обучения. Объясняю через наглядность и практику, подбираю темп под ребёнка. Работаю в связке с учителем и родителями.',
      experienceYears: 15,
      experienceText: 'ЕНУ им. Гумилёва, олигофренопедагогика. 15 лет в коррекционной школе и инклюзивном классе.',
      specializations: ['special_ed', 'primary'],
      ageMin: 5,
      ageMax: 12,
      formats: ['online', 'offline'],
      city: 'Астана',
      languages: ['ru', 'kk'],
    },
    // Мария отправила изменения — в каталоге пока прежняя версия, модератор видит обновление.
    pendingChanges: {
      description:
        'Готовлю к школе и сопровождаю в 1–4 классах детей с трудностями обучения. Объясняю через наглядность и практику, подбираю темп под ребёнка. Работаю в связке с учителем и родителями. Новое: занятия по чтению для детей с дислексией.',
      specializations: ['special_ed', 'primary', 'reading'],
    },
  },
  {
    key: 'olga',
    name: 'Ольга Волкова',
    email: 'olga@demo.pingo.app',
    avatar: 'hero',
    session: 60,
    schedule: [
      [6, '11:00', '15:00'],
      [0, '11:00', '15:00'],
      [3, '18:00', '20:00'],
    ],
    data: {
      kind: 'volunteer',
      title: 'Волонтёр-наставник: общение, поддержка и уроки',
      description:
        'Студентка 4 курса психологического факультета. Помогаю подросткам с РАС и СДВГ: вместе делаем уроки, учимся договариваться, обсуждаем любимые игры и книги. Для многих ребят я — старший друг, с которым спокойно.',
      experienceYears: 2,
      experienceText: 'КазНУ, психология (4 курс). 2 года волонтёрства в фонде поддержки семей.',
      specializations: ['social', 'subjects'],
      ageMin: 10,
      ageMax: 17,
      formats: ['online'],
      city: '',
      languages: ['ru', 'en'],
    },
  },
  {
    key: 'aigerim',
    name: 'Айгерим Нурланова',
    email: 'aigerim@demo.pingo.app',
    avatar: 'raincoat',
    session: 60,
    schedule: [
      [2, '17:00', '20:00'],
      [4, '17:00', '20:00'],
      [0, '12:00', '15:00'],
    ],
    data: {
      kind: 'volunteer',
      title: 'Студентка-волонтёр: математика и домашние задания',
      description:
        'Учусь на учителя математики. Помогаю разобраться с домашними заданиями и закрыть пробелы по программе 1–7 классов. Объясняю на казахском и русском, рисую схемы и придумываю задачки про то, что ребёнку интересно.',
      experienceYears: 1,
      experienceText: 'КазНПУ им. Абая, математика (3 курс). Волонтёр летней инклюзивной школы.',
      specializations: ['subjects', 'primary'],
      ageMin: 6,
      ageMax: 14,
      formats: ['online'],
      city: '',
      languages: ['ru', 'kk', 'en'],
    },
  },
  {
    key: 'timur',
    name: 'Тимур Ахметов',
    email: 'timur@demo.pingo.app',
    avatar: 'chef',
    session: 45,
    schedule: [1, 2, 3, 4, 5].map((d) => [d, '10:00', '13:00']),
    data: {
      kind: 'specialist',
      title: 'АВА-терапевт: коммуникация и самостоятельность',
      description:
        'Строю программы на основе прикладного анализа поведения: учим ребёнка просить, ждать, играть рядом с другими и выполнять бытовые цепочки. Каждые две недели показываю родителям графики прогресса.',
      experienceYears: 7,
      experienceText: 'Поведенческий аналитик (RBT, курс BCaBA). 7 лет работы в АВА-центре.',
      specializations: ['aba', 'social', 'alt_comm'],
      ageMin: 2,
      ageMax: 9,
      formats: ['online', 'offline'],
      city: 'Астана',
      languages: ['ru', 'kk'],
    },
  },
  {
    key: 'maxim',
    name: 'Максим Орлов',
    email: 'maxim@demo.pingo.app',
    avatar: 'traveler',
    session: 60,
    schedule: [1, 3, 5].map((d) => [d, '18:00', '21:00']),
    data: {
      kind: 'volunteer',
      title: 'Волонтёр: английский и чтение без стресса',
      description:
        'Студент-лингвист. Занимаюсь английским и чтением с ребятами, которым сложно сосредоточиться: короткие задания, игры и много поддержки. Спокойно отношусь к ошибкам — главное, чтобы было интересно.',
      experienceYears: 1,
      experienceText: 'Переводческое дело (2 курс). Репетитор английского с 2024 года.',
      specializations: ['subjects', 'reading'],
      ageMin: 8,
      ageMax: 16,
      formats: ['online'],
      city: '',
      languages: ['ru', 'en'],
    },
  },
];

const IN_REVIEW = [
  {
    name: 'Динара Сеитова',
    email: 'dinara@demo.pingo.app',
    avatar: 'ballerina',
    status: 'pending',
    ago: 30 * MINUTE,
    data: {
      kind: 'specialist',
      title: 'Эрготерапевт и инструктор ЛФК',
      description:
        'Помогаю детям с ДЦП и нарушениями координации: упражнения на равновесие, мелкую моторику, навыки самообслуживания. После каждого занятия даю домашнюю программу с видео.',
      experienceYears: 9,
      experienceText: 'Медицинский университет Астана, реабилитология. 9 лет в реабилитационном центре.',
      specializations: ['ot', 'motor'],
      ageMin: 3,
      ageMax: 14,
      formats: ['online', 'offline'],
      city: 'Шымкент',
      languages: ['ru', 'kk'],
    },
  },
  {
    name: 'Ирина Соколова',
    email: 'irina@demo.pingo.app',
    avatar: 'wizard',
    status: 'pending',
    ago: 2 * HOUR,
    data: {
      kind: 'specialist',
      title: 'Логопед для малышей 2–5 лет',
      description:
        'Специализируюсь на раннем развитии речи: артикуляционная гимнастика, логопедический массаж, игры на развитие слухового внимания. Работаю онлайн вместе с родителем — учу маму или папу продолжать занятия дома.',
      experienceYears: 5,
      experienceText: 'КарГУ, логопедия. 5 лет в детском саду компенсирующего вида.',
      specializations: ['speech'],
      ageMin: 2,
      ageMax: 5,
      formats: ['online'],
      city: '',
      languages: ['ru'],
    },
  },
  {
    name: 'Павел Морозов',
    email: 'pavel@demo.pingo.app',
    avatar: 'pirate',
    status: 'pending',
    ago: DAY,
    data: {
      kind: 'volunteer',
      title: 'Волонтёр: физика и математика для старших классов',
      description:
        'Учусь в техническом университете и люблю объяснять сложное простыми словами. Помогаю школьникам 7–11 классов с физикой и математикой, в том числе ребятам с СДВГ — сам знаю, каково это.',
      experienceYears: 1,
      experienceText: 'Технический университет, 3 курс.',
      specializations: ['subjects'],
      ageMin: 12,
      ageMax: 17,
      formats: ['online'],
      city: '',
      languages: ['ru', 'kk'],
    },
  },
  {
    name: 'Алексей Белов',
    email: 'alexey@demo.pingo.app',
    avatar: 'traveler',
    status: 'rejected',
    ago: 3 * DAY,
    reason: 'Расскажите подробнее об опыте общения с детьми и о том, с какими предметами можете помочь.',
    data: {
      kind: 'volunteer',
      title: 'Помогаю детям с уроками',
      description: 'Хочу помогать детям с уроками. Свободен по вечерам и в выходные, могу заниматься онлайн.',
      experienceYears: 0,
      experienceText: '',
      specializations: ['subjects'],
      ageMin: 7,
      ageMax: 12,
      formats: ['online'],
      city: '',
      languages: ['ru'],
    },
  },
];

const REVIEWS = {
  anna: [
    [5, 'Сын впервые сам попросил «ещё» с помощью карточки! Анна очень терпеливая.', 'Айжан, родитель', 4, 12],
    [5, 'Занятия проходят в игре, дочка ждёт их всю неделю.', 'Марина, родитель', 6, 30],
    [4, 'Хороший специалист, подробно объясняет домашние задания.', 'Ержан, родитель', 7, 45],
  ],
  elena: [[5, 'Помогла справиться с истериками перед школой. Спасибо за поддержку!', 'Ольга, родитель', 9, 20]],
  sergey: [[5, 'За два месяца научились застёгивать пуговицы и держать ложку.', 'Динара, родитель', 5, 16]],
  dmitry: [[4, 'Структурные занятия, видно прогресс во внимании.', 'Алексей, родитель', 10, 25]],
  maria: [[5, 'Подготовила к первому классу — ребёнок пошёл в школу уверенно.', 'Сауле, родитель', 7, 40]],
  olga: [[5, 'Сын стал общительнее и ждёт встреч с Ольгой.', 'Ирина, родитель', 13, 11]],
  aigerim: [[5, 'Объясняет математику и на казахском, и на русском — очень удобно.', 'Гульнара, родитель', 9, 8]],
  timur: [[5, 'Через три месяца сын начал просить жестами и карточками.', 'Асель, родитель', 4, 33]],
  maxim: [[4, 'Помогает с английским, спокойный и внимательный.', 'Наталья, родитель', 12, 14]],
};

function fullData(data) {
  return { ...emptyProfileData(), ...data, documents: [], agreements: { ...AGREED } };
}

function birthDate(now, years, months) {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - months);
  return toDateKey(d);
}

function scheduleRules(specialistId, schedule, now) {
  return schedule.map(([weekday, start, end]) => ({
    id: uid(),
    specialistId,
    type: 'weekly',
    weekday,
    date: null,
    start,
    end,
    createdAt: now - 30 * DAY,
  }));
}

// Демо-родитель «Гость»: двое детей, записи во всех статусах, чаты и уведомления.
// Вынесено отдельно, чтобы «Сбросить демо-данные» пересоздавало их с актуальным временем.
export function buildDemoParentData(now, { parentId, sp, annaRules }) {
  const children = [
    {
      id: uid(),
      parentId,
      name: 'Алия',
      avatar: 'raincoat',
      birthDate: birthDate(now, 7, 3),
      needs: ['autism', 'speech_delay', 'social'],
      needsOther: '',
      learningStyles: ['visual', 'play'],
      goals: 'Расширить словарный запас и научиться просить о помощи.',
      notes: 'Боится громких звуков. Любит пингвинов и карточки с животными. Лучше занимается утром.',
      accessibility: { ...DEFAULT_A11Y },
      consentAt: now - 20 * DAY,
      createdAt: now - 20 * DAY,
      updatedAt: now - 20 * DAY,
    },
    {
      id: uid(),
      parentId,
      name: 'Артём',
      avatar: 'artist',
      birthDate: birthDate(now, 10, 1),
      needs: ['adhd', 'learning', 'dyslexia'],
      needsOther: '',
      learningStyles: ['kinesthetic', 'structured'],
      goals: 'Читать без пропусков букв и удерживать внимание 15 минут.',
      notes: 'Нужны короткие перерывы каждые 10 минут. Хорошо реагирует на таймер.',
      accessibility: { ...DEFAULT_A11Y, reduceMotion: true, lineSpacing: 'relaxed', readableFont: true },
      consentAt: now - 18 * DAY,
      createdAt: now - 18 * DAY,
      updatedAt: now - 18 * DAY,
    },
  ];
  const [aliya, artem] = children;

  const mk = (o) => ({
    id: uid(),
    parentId,
    statusReason: null,
    cancelledBy: null,
    report: null,
    reviewId: null,
    note: '',
    ...o,
    end: o.start + o.duration * MINUTE,
    updatedAt: o.updatedAt ?? o.createdAt,
  });

  // 1) Подтверждённое онлайн-занятие через 10 минут — видеокомната уже открыта.
  const soon = Math.ceil((now + 10 * MINUTE) / (5 * MINUTE)) * 5 * MINUTE;
  const bSoon = mk({
    childId: aliya.id,
    specialistId: sp.anna,
    start: soon,
    duration: 45,
    format: 'online',
    note: 'Алия плохо переносит громкие звуки — можно начать с тихих игр?',
    status: 'confirmed',
    createdAt: now - DAY,
    confirmedAt: now - 20 * HOUR,
    updatedAt: now - 20 * HOUR,
  });
  // 2) Новый запрос для Артёма — Анна увидит его во вкладке «Запросы».
  const tomorrow = startOfDay(addDays(now, 1)).getTime();
  const annaSlots = generateSlots({ rules: annaRules, busy: [bSoon], duration: 45, from: now });
  const pendingSlot = annaSlots.find((s) => s.start >= tomorrow) ?? annaSlots[0];
  const bPending = mk({
    childId: artem.id,
    specialistId: sp.anna,
    start: pendingSlot.start,
    duration: 45,
    format: 'online',
    note: '',
    status: 'pending',
    createdAt: now - 2 * HOUR,
  });
  // 3) Проведённое занятие с отчётом и отзывом.
  const pastElena = atMinutes(addDays(now, -6), 10 * 60);
  const bElena = mk({
    childId: aliya.id,
    specialistId: sp.elena,
    start: pastElena,
    duration: 60,
    format: 'online',
    status: 'confirmed',
    createdAt: now - 8 * DAY,
    confirmedAt: now - 7 * DAY,
    report: {
      summary: 'Знакомились, играли в «Эмоции на карточках». Алия узнала 4 эмоции из 6 и сама показала «радость» и «грусть».',
      progress: 'Удерживала внимание 20 минут, спокойно переходила от задания к заданию.',
      homework: 'Каждый вечер вспоминать одну эмоцию за день с помощью карточек.',
      createdAt: pastElena + 80 * MINUTE,
    },
  });
  // 4) Проведённое занятие с отчётом, но без отзыва — Pingo предложит его оставить.
  const pastAnna = atMinutes(addDays(now, -14), 10 * 60);
  const bAnnaPast = mk({
    childId: aliya.id,
    specialistId: sp.anna,
    start: pastAnna,
    duration: 45,
    format: 'online',
    status: 'confirmed',
    createdAt: now - 16 * DAY,
    confirmedAt: now - 15 * DAY,
    report: {
      summary: 'Первое занятие: знакомство, карточки с животными, упражнения на подражание звукам.',
      progress: 'Алия повторила 5 звукоподражаний и дважды сама попросила карточку жестом.',
      homework: 'Играть в «Кто как говорит?» по 5 минут в день.',
      createdAt: pastAnna + 60 * MINUTE,
    },
  });
  // 5) Отменённое родителем.
  const bCancelled = mk({
    childId: artem.id,
    specialistId: sp.dmitry,
    start: atMinutes(addDays(now, -2), 16 * 60),
    duration: 60,
    format: 'online',
    status: 'cancelled',
    statusReason: 'Ребёнок заболел.',
    cancelledBy: parentId,
    createdAt: now - 5 * DAY,
    confirmedAt: now - 4 * DAY,
    updatedAt: now - 3 * DAY,
  });
  // 6) Отклонённое специалистом.
  const bDeclined = mk({
    childId: aliya.id,
    specialistId: sp.sergey,
    start: atMinutes(addDays(now, 2), 11 * 60),
    duration: 45,
    format: 'offline',
    status: 'declined',
    statusReason: 'В это время я уже занят(а).',
    createdAt: now - 4 * DAY,
    updatedAt: now - 3 * DAY,
  });
  const bookings = [bSoon, bPending, bElena, bAnnaPast, bCancelled, bDeclined];

  const review = {
    id: uid(),
    specialistId: sp.elena,
    parentId,
    bookingId: bElena.id,
    authorName: 'Гость, родитель',
    childAge: 7,
    rating: 5,
    text: 'Алия спокойно провела всё занятие и потом сама рассказывала про эмоции. Для нас это большой шаг!',
    createdAt: pastElena + 3 * HOUR,
  };
  bElena.reviewId = review.id;

  const conversations = [];
  const messages = [];
  const conv = (specialistId, unread, script) => {
    const id = conversationIdFor(parentId, specialistId);
    const list = script.map(([at, senderId, text, bookingId = null]) => ({
      id: uid(),
      conversationId: id,
      senderId,
      text,
      kind: senderId === 'system' ? 'system' : 'text',
      bookingId,
      createdAt: at,
    }));
    const last = list[list.length - 1];
    conversations.push({
      id,
      parentId,
      specialistId,
      createdAt: list[0].createdAt,
      updatedAt: last.createdAt,
      lastText: last.text,
      lastKind: last.kind,
      lastSenderId: last.senderId,
      unread: { [parentId]: unread.parent, [specialistId]: unread.specialist },
    });
    messages.push(...list);
  };

  conv(sp.anna, { parent: 0, specialist: 2 }, [
    [bAnnaPast.createdAt, 'system', `Запрос на занятие: ${fmtStamp(bAnnaPast.start)} · Алия`, bAnnaPast.id],
    [bAnnaPast.confirmedAt, 'system', `Занятие подтверждено: ${fmtStamp(bAnnaPast.start)}`, bAnnaPast.id],
    [bAnnaPast.end + 30 * MINUTE, sp.anna, 'Спасибо за занятие! Отчёт в карточке записи. Алия — большая молодец 🐧'],
    [bSoon.createdAt, 'system', `Запрос на занятие: ${fmtStamp(bSoon.start)} · Алия`, bSoon.id],
    [bSoon.createdAt + 1000, parentId, bSoon.note],
    [bSoon.confirmedAt, 'system', `Занятие подтверждено: ${fmtStamp(bSoon.start)}`, bSoon.id],
    [
      bSoon.confirmedAt + MINUTE,
      sp.anna,
      'Здравствуйте! Конечно, начнём со спокойных игр с карточками. Если Алия устанет — сделаем паузу.',
    ],
    [bPending.createdAt, 'system', `Запрос на занятие: ${fmtStamp(bPending.start)} · Артём`, bPending.id],
    [bPending.createdAt + 1000, parentId, 'Хотим попробовать и с Артёмом: ему 10, СДВГ, сложно даётся чтение.'],
  ]);
  conv(sp.elena, { parent: 0, specialist: 0 }, [
    [bElena.createdAt, 'system', `Запрос на занятие: ${fmtStamp(bElena.start)} · Алия`, bElena.id],
    [bElena.confirmedAt, 'system', `Занятие подтверждено: ${fmtStamp(bElena.start)}`, bElena.id],
    [bElena.confirmedAt + 5 * MINUTE, sp.elena, 'Добрый день! Жду Алию на занятии. Если будут вопросы — пишите.'],
    [bElena.end + 20 * MINUTE, sp.elena, 'Спасибо за занятие! Добавила отчёт. Алия справилась отлично 💛'],
    [bElena.end + 2 * HOUR, parentId, 'Спасибо большое! Будем тренироваться дома с карточками.'],
  ]);
  conv(sp.dmitry, { parent: 0, specialist: 0 }, [
    [bCancelled.createdAt, 'system', `Запрос на занятие: ${fmtStamp(bCancelled.start)} · Артём`, bCancelled.id],
    [bCancelled.confirmedAt, 'system', `Занятие подтверждено: ${fmtStamp(bCancelled.start)}`, bCancelled.id],
    [
      bCancelled.updatedAt,
      'system',
      `Гость отменил(а) занятие ${fmtStamp(bCancelled.start)}: Ребёнок заболел.`,
      bCancelled.id,
    ],
    [bCancelled.updatedAt + 30 * MINUTE, sp.dmitry, 'Выздоравливайте! Запишитесь, когда будет удобно.'],
  ]);
  conv(sp.sergey, { parent: 1, specialist: 0 }, [
    [bDeclined.createdAt, 'system', `Запрос на занятие: ${fmtStamp(bDeclined.start)} · Алия`, bDeclined.id],
    [bDeclined.updatedAt, 'system', 'Запрос отклонён: В это время я уже занят(а).', bDeclined.id],
    [
      bDeclined.updatedAt + MINUTE,
      sp.sergey,
      'Извините, это время уже занято. Посмотрите окна на следующей неделе — в субботу есть свободное утро.',
    ],
  ]);

  const n = (userId, at, type, title, body, link, read) => ({
    id: uid(),
    userId,
    type,
    title,
    body,
    link,
    read,
    createdAt: at,
  });
  const notifications = [
    n(parentId, bSoon.confirmedAt, 'booking_confirmed', 'Занятие подтверждено', `Анна Петрова ждёт Алию · ${fmtStamp(bSoon.start)}`, `/parent/bookings/${bSoon.id}`, false),
    n(parentId, bDeclined.updatedAt, 'booking_declined', 'Запрос отклонён', 'Сергей Ким: В это время я уже занят(а).', `/parent/bookings/${bDeclined.id}`, true),
    n(parentId, bElena.report.createdAt, 'report_added', 'Отчёт о занятии', 'Елена Смирнова рассказала, как прошло занятие с Алией', `/parent/bookings/${bElena.id}`, true),
    n(parentId, bAnnaPast.report.createdAt, 'report_added', 'Отчёт о занятии', 'Анна Петрова рассказала, как прошло занятие с Алией', `/parent/bookings/${bAnnaPast.id}`, true),
    n(sp.anna, bPending.createdAt, 'booking_request', 'Новый запрос на занятие', `Гость · Артём, 10 лет · ${fmtStamp(bPending.start)}`, `/specialist/requests/${bPending.id}`, false),
    n(sp.anna, bSoon.createdAt, 'booking_request', 'Новый запрос на занятие', `Гость · Алия, 7 лет · ${fmtStamp(bSoon.start)}`, `/specialist/requests/${bSoon.id}`, true),
    n(sp.elena, review.createdAt, 'review_added', 'Новый отзыв: ★★★★★', review.text, `/specialist/requests/${bElena.id}`, true),
    n(sp.dmitry, bCancelled.updatedAt, 'booking_cancelled', 'Занятие отменено', `Гость · Артём · ${fmtStamp(bCancelled.start)} — Ребёнок заболел.`, `/specialist/requests/${bCancelled.id}`, true),
  ];

  return { children, bookings, reviews: [review], conversations, messages, notifications };
}

async function writeDemoData(data) {
  await db.children.bulkAdd(data.children);
  await db.bookings.bulkAdd(data.bookings);
  await db.reviews.bulkAdd(data.reviews);
  await db.conversations.bulkAdd(data.conversations);
  await db.messages.bulkAdd(data.messages);
  await db.notifications.bulkAdd(data.notifications);
}

export async function ensureSeed() {
  const meta = await db.meta.get('seed');
  if (meta?.version >= SEED_VERSION) return;
  try {
    await seedAll();
  } catch (e) {
    // Если две вкладки открылись одновременно, вторая просто увидит готовые данные.
    if (!(await db.meta.get('seed'))) throw e;
  }
}

async function seedAll() {
  const now = Date.now();
  // Хеши паролей считаем до транзакции: внутри неё нельзя ждать не-IndexedDB промисы.
  const admin = await buildUser({
    role: 'admin',
    name: 'Модератор Pingo',
    email: DEMO_ACCOUNTS.admin,
    password: DEMO_PASSWORD,
    isDemo: true,
    extra: { tourDone: true, createdAt: now - 90 * DAY },
  });
  const parent = await buildUser({
    role: 'parent',
    name: 'Гость',
    email: DEMO_ACCOUNTS.parent,
    password: DEMO_PASSWORD,
    isDemo: true,
    extra: { createdAt: now - 21 * DAY },
  });
  const otherParent = await buildUser({
    role: 'parent',
    name: 'Айжан Сейтказы',
    email: 'aizhan@demo.pingo.app',
    password: DEMO_PASSWORD,
    isDemo: true,
    extra: { tourDone: true, createdAt: now - 40 * DAY },
  });

  const users = [admin, parent, otherParent];
  const profiles = [];
  const rules = [];
  const reviews = [];
  const sp = {};
  const notifications = [];

  for (const def of APPROVED) {
    const user = await buildUser({
      role: 'specialist',
      name: def.name,
      email: def.email,
      password: DEMO_PASSWORD,
      isDemo: true,
      extra: { avatar: def.avatar, tourDone: true, createdAt: now - 60 * DAY },
    });
    users.push(user);
    sp[def.key] = user.id;
    const published = fullData(def.data);
    const submittedAt = now - 50 * DAY;
    const reviewedAt = now - 49 * DAY;
    const history = [
      { at: submittedAt, action: 'submitted', by: user.id },
      { at: reviewedAt, action: 'approved', by: admin.id },
    ];
    const profile = {
      ...newProfile(user.id, now - 60 * DAY),
      status: 'approved',
      draft: structuredClone(published),
      published,
      trainingDone: ALL_TRAINING,
      sessionMinutes: def.session,
      submittedAt,
      reviewedAt,
      reviewedBy: admin.id,
      history,
      updatedAt: reviewedAt,
    };
    if (def.pendingChanges) {
      const at = now - 5 * HOUR;
      Object.assign(profile.draft, def.pendingChanges);
      profile.status = 'pending';
      profile.submittedAt = at;
      profile.updatedAt = at;
      profile.history = [...history, { at, action: 'submitted', by: user.id }];
      notifications.push({
        id: uid(),
        userId: admin.id,
        type: 'profile_submitted',
        title: 'Изменения в анкете на модерации',
        body: `${def.name} · специалист`,
        link: `/admin/profiles/${user.id}`,
        read: false,
        createdAt: at,
      });
    }
    profiles.push(profile);
    rules.push(...scheduleRules(user.id, def.schedule, now));
    for (const [rating, text, authorName, childAge, daysAgo] of REVIEWS[def.key] || []) {
      reviews.push({
        id: uid(),
        specialistId: user.id,
        parentId: null,
        bookingId: null,
        authorName,
        childAge,
        rating,
        text,
        createdAt: now - daysAgo * DAY,
      });
    }
  }

  for (const def of IN_REVIEW) {
    const user = await buildUser({
      role: 'specialist',
      name: def.name,
      email: def.email,
      password: DEMO_PASSWORD,
      isDemo: true,
      extra: { avatar: def.avatar, createdAt: now - def.ago - 2 * DAY },
    });
    users.push(user);
    const at = now - def.ago;
    const profile = {
      ...newProfile(user.id, now - def.ago - 2 * DAY),
      status: def.status,
      draft: fullData(def.data),
      trainingDone: ALL_TRAINING,
      submittedAt: at,
      updatedAt: at,
      history: [{ at, action: 'submitted', by: user.id }],
    };
    if (def.status === 'rejected') {
      const rejectedAt = at + 6 * HOUR;
      Object.assign(profile, {
        rejectionReason: def.reason,
        reviewedAt: rejectedAt,
        reviewedBy: admin.id,
        updatedAt: rejectedAt,
        history: [...profile.history, { at: rejectedAt, action: 'rejected', by: admin.id, reason: def.reason }],
      });
    } else {
      notifications.push({
        id: uid(),
        userId: admin.id,
        type: 'profile_submitted',
        title: 'Новая анкета на модерации',
        body: `${def.name} · ${def.data.kind === 'volunteer' ? 'волонтёр' : 'специалист'}`,
        link: `/admin/profiles/${user.id}`,
        read: false,
        createdAt: at,
      });
    }
    profiles.push(profile);
  }

  parent.activeChildId = null;
  parent.favorites = [sp.anna, sp.elena];
  const demo = buildDemoParentData(now, {
    parentId: parent.id,
    sp,
    annaRules: rules.filter((r) => r.specialistId === sp.anna),
  });
  parent.activeChildId = demo.children[0].id;

  const complaint = {
    id: uid(),
    reporterId: otherParent.id,
    targetId: sp.maxim,
    reason: 'behavior',
    details: 'Опоздал на занятие на 20 минут и не предупредил в чате.',
    context: null,
    status: 'open',
    resolution: null,
    createdAt: now - DAY,
    resolvedAt: null,
  };
  notifications.push({
    id: uid(),
    userId: admin.id,
    type: 'complaint',
    title: 'Новая жалоба',
    body: 'Айжан Сейтказы → Максим Орлов: Неуважительное поведение',
    link: '/admin/reports',
    read: false,
    createdAt: complaint.createdAt,
  });

  await db.transaction('rw', db.tables, async () => {
    await db.users.bulkAdd(users);
    await db.profiles.bulkAdd(profiles);
    await db.availability.bulkAdd(rules);
    await db.reviews.bulkAdd(reviews);
    await db.notifications.bulkAdd(notifications);
    await db.complaints.add(complaint);
    await writeDemoData(demo);
    await db.meta.put({ key: 'seed', version: SEED_VERSION, at: now });
  });
}

// Пересоздать данные демо-родителя с актуальным временем (настройки → «Сбросить демо-данные»).
export async function resetDemoParent() {
  const parent = await db.users.where('email').equals(DEMO_ACCOUNTS.parent).first();
  if (!parent) return;
  const keys = ['anna', 'elena', 'dmitry', 'sergey'];
  const emails = Object.fromEntries(APPROVED.filter((d) => keys.includes(d.key)).map((d) => [d.key, d.email]));
  const sp = {};
  for (const k of keys) {
    const u = await db.users.where('email').equals(emails[k]).first();
    if (!u) throw new Error('Демо-специалисты не найдены — сбросьте все данные');
    sp[k] = u.id;
  }
  const annaRules = await db.availability.where('specialistId').equals(sp.anna).toArray();
  const oldBookings = await db.bookings.where('parentId').equals(parent.id).toArray();
  const oldBookingIds = oldBookings.map((b) => b.id);
  const deadLinks = new Set(oldBookingIds.map((id) => `/specialist/requests/${id}`));
  const data = buildDemoParentData(Date.now(), { parentId: parent.id, sp, annaRules });

  await db.transaction('rw', db.tables, async () => {
    const convIds = await db.conversations.where('parentId').equals(parent.id).primaryKeys();
    await db.messages.where('conversationId').anyOf(convIds).delete();
    await db.conversations.bulkDelete(convIds);
    await db.children.where('parentId').equals(parent.id).delete();
    await db.bookings.bulkDelete(oldBookingIds);
    await db.reviews.where('bookingId').anyOf(oldBookingIds).delete();
    await db.notifications.where('userId').equals(parent.id).delete();
    await db.notifications.filter((x) => deadLinks.has(x.link)).delete();
    await writeDemoData(data);
    await db.users.update(parent.id, { activeChildId: data.children[0].id });
  });
}
