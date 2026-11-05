import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  ChatsCircleIcon,
  HandHeartIcon,
  HeartIcon,
  IdentificationCardIcon,
  ShieldCheckIcon,
  TextAaIcon,
  UsersThreeIcon,
  VideoCameraIcon,
} from '@phosphor-icons/react';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Blob, Heart, Smiley } from '../../components/Decor';
import { Pingo } from '../../components/Pingo';
import { ButtonLink } from '../../components/ui';

const float = (duration, delay = 0, y = 12, rotate = 6) => ({
  animate: { y: [0, -y, 0], rotate: [0, rotate, 0] },
  transition: { duration, delay, repeat: Infinity, ease: 'easeInOut' },
});

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { type: 'spring', stiffness: 160, damping: 22 },
};

const STEPS = [
  {
    icon: IdentificationCardIcon,
    title: 'Профиль ребёнка',
    text: 'Пингвин-гид поможет рассказать о ребёнке: возраст, особенности и как ему легче учиться.',
  },
  {
    icon: UsersThreeIcon,
    title: 'Подбор специалиста',
    text: 'Логопеды, психологи, репетиторы, эрготерапевты и волонтёры с проверенными анкетами.',
  },
  {
    icon: VideoCameraIcon,
    title: 'Занятия онлайн',
    text: 'Запись, чат и видеоурок в одном месте. Комната открывается за 15 минут до начала.',
  },
];

const SAFETY = [
  'Каждую анкету специалиста проверяет модератор',
  'Все специалисты проходят обучение по безопасности детей',
  'Общение и видеозанятия — только внутри платформы',
  'Пожаловаться на пользователя можно в один клик',
];

export default function Welcome() {
  useThemeColor('#FFFFFF');

  return (
    <div className="welcome">
      <section className="welcome__hero">
        <div className="welcome__decor" aria-hidden="true">
          <motion.div className="deco deco--smiley" {...float(7)}>
            <Smiley size={230} />
          </motion.div>
          <motion.div className="deco deco--blob-top" {...float(9, 0.5, 10, -5)}>
            <Blob size={190} />
          </motion.div>
          <motion.div className="deco deco--blob-bottom" {...float(8, 1, 14, 4)}>
            <Blob size={170} />
          </motion.div>
          <motion.div className="deco deco--heart" {...float(5.5, 0.3, 10, -8)}>
            <Heart size={150} />
          </motion.div>
        </div>

        <motion.div
          className="welcome__art"
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.1 }}
        >
          <motion.img
            src="/images/hero-boat.png"
            alt="Пингвин Pingo плывёт на жёлтом кораблике"
            className="welcome__boat"
            animate={{ rotate: [-2.5, 2.5, -2.5], y: [0, -8, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <svg className="welcome__waves" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 20 Q 25 5 50 20 T 100 20 T 150 20 T 200 20 T 250 20 T 300 20 T 350 20 T 400 20 T 450 20 T 500 20" />
          </svg>
        </motion.div>

        <div className="welcome__copy">
          <motion.h1
            className="welcome__title"
            initial={{ opacity: 0, letterSpacing: '0.2em' }}
            animate={{ opacity: 1, letterSpacing: '-0.02em' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
          >
            PINGO
          </motion.h1>
          <motion.p className="welcome__slogan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            Support for every child
          </motion.p>
          <motion.p className="welcome__sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            Помогаем детям расти с заботой. Родители находят волонтёров и специалистов для занятий с детьми с особыми
            потребностями.
          </motion.p>
          <motion.div
            className="welcome__actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 22 }}
          >
            <ButtonLink to="/register" variant="dark" size="lg" block>
              Начать
            </ButtonLink>
            <Link to="/login" className="welcome__link">
              У меня уже есть аккаунт <ArrowRightIcon size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="landing">
        <motion.div className="landing__head" {...reveal}>
          <span className="eyebrow">Как это работает</span>
          <h2>Три шага до первого занятия</h2>
        </motion.div>
        <div className="landing__steps">
          {STEPS.map((s, i) => (
            <motion.article key={s.title} className="step-card" {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
              <span className="step-card__num">{i + 1}</span>
              <s.icon size={34} weight="fill" className="step-card__icon" />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </motion.article>
          ))}
        </div>

        <div className="landing__roles">
          <motion.article className="role-promo role-promo--parent" {...reveal}>
            <img src="/images/role-parent.png" alt="" className="role-promo__img" />
            <div>
              <span className="label-font">Родителям</span>
              <ul>
                <li>Профиль ребёнка с особенностями и целями</li>
                <li>Подбор специалистов под потребности</li>
                <li>Запись, чат, видеоуроки и отчёты</li>
              </ul>
              <ButtonLink to="/register/parent" variant="dark" iconRight={ArrowRightIcon}>
                Я родитель
              </ButtonLink>
            </div>
          </motion.article>
          <motion.article className="role-promo role-promo--specialist" {...reveal}>
            <img src="/images/role-specialist.png" alt="" className="role-promo__img" />
            <div>
              <span className="label-font">Специалистам и волонтёрам</span>
              <ul>
                <li>Анкета и короткое обучение по безопасности</li>
                <li>Гибкое расписание: каждую неделю или разовые даты</li>
                <li>Запросы, чат и видеозанятия в одном месте</li>
              </ul>
              <ButtonLink to="/register/specialist" variant="dark" iconRight={ArrowRightIcon}>
                Хочу помогать
              </ButtonLink>
            </div>
          </motion.article>
        </div>

        <motion.div className="safety" {...reveal}>
          <div className="safety__text">
            <span className="eyebrow eyebrow--light">Безопасность</span>
            <h2>Дети — прежде всего</h2>
            <ul>
              {SAFETY.map((s) => (
                <li key={s}>
                  <ShieldCheckIcon size={22} weight="fill" /> {s}
                </li>
              ))}
            </ul>
          </div>
          <Pingo size={170} mood="happy" outfit="glasses" className="safety__pingo" />
        </motion.div>

        <div className="landing__features">
          {[
            { icon: TextAaIcon, title: 'Интерфейс под ребёнка', text: 'Крупный текст, межстрочный интервал и меньше анимаций — для каждого ребёнка свои.' },
            { icon: ChatsCircleIcon, title: 'Чат со специалистом', text: 'Обсуждайте цели и детали занятий, не переходя в мессенджеры.' },
            { icon: HandHeartIcon, title: 'Волонтёры', text: 'Студенты и педагоги, которые помогают бесплатно и проходят проверку.' },
          ].map((f, i) => (
            <motion.article key={f.title} className="feature" {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
              <f.icon size={28} weight="fill" />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </motion.article>
          ))}
        </div>

        <motion.div className="landing__cta" {...reveal}>
          <Pingo size={110} mood="open" wave />
          <h2>Готовы начать?</h2>
          <p>Регистрация займёт пару минут. Pingo проведёт по всем шагам.</p>
          <div className="landing__cta-actions">
            <ButtonLink to="/register" variant="dark" size="lg">
              Создать аккаунт
            </ButtonLink>
            <ButtonLink to="/login" variant="light" size="lg">
              Войти
            </ButtonLink>
          </div>
        </motion.div>
      </section>

      <footer className="landing-footer">
        <span>
          <img src="/favicon.png" alt="" width="24" height="24" /> Pingo · Support for every child
        </span>
        <span>
          Сделано с <HeartIcon size={14} weight="fill" /> для детей и их семей · 2026
        </span>
      </footer>
    </div>
  );
}
