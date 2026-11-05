import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { updateUser } from '../services/auth';
import { Pingo } from './Pingo';
import { Sheet } from './Sheet';
import { Button } from './ui';
import { t } from '../i18n';

const SLIDES = {
  parent: [
    {
      mood: 'happy',
      wave: true,
      title: t('Привет! Я Pingo 🐧'),
      text: t('Я помогу найти специалиста или волонтёра для вашего ребёнка и не потеряться в записях.'),
    },
    {
      mood: 'open',
      outfit: 'glasses',
      title: t('Специалисты'),
      text: t('Логопеды, психологи, репетиторы, эрготерапевты и волонтёры. Все анкеты проверяет модератор, а я отмечаю тех, кто подходит вашему ребёнку.'),
    },
    {
      mood: 'wink',
      title: t('Записи и видеоуроки'),
      text: t('Выберите время и отправьте запрос. Когда специалист подтвердит запись, видеокомната откроется за 15 минут до начала.'),
    },
    {
      mood: 'happy',
      outfit: 'scarf',
      title: t('Под каждого ребёнка'),
      text: t('В профиле ребёнка можно включить крупный текст, увеличенный интервал и меньше анимаций — приложение подстроится.'),
    },
  ],
  specialist: [
    {
      mood: 'happy',
      wave: true,
      title: t('Привет! Я Pingo 🐧'),
      text: t('Помогу вам найти семьи, которым нужна ваша поддержка.'),
    },
    {
      mood: 'open',
      outfit: 'glasses',
      title: t('Анкета и обучение'),
      text: t('Заполните анкету и пройдите короткое обучение по безопасности. После проверки модератором вы появитесь в каталоге.'),
    },
    {
      mood: 'wink',
      title: t('Расписание'),
      text: t('Добавьте еженедельные окна или разовые даты — родители запишутся на свободное время.'),
    },
    {
      mood: 'happy',
      outfit: 'scarf',
      title: t('Запросы и занятия'),
      text: t('Подтверждайте запросы, общайтесь в чате и проводите видеозанятия прямо в Pingo.'),
    },
  ],
};

// Короткое знакомство с приложением от пингвина-гида. Показывается один раз.
export function Tour({ user, open, onClose }) {
  const slides = SLIDES[user.role] ?? SLIDES.parent;
  const [i, setI] = useState(0);
  const slide = slides[i];
  const last = i === slides.length - 1;

  const finish = async () => {
    await updateUser(user.id, { tourDone: true });
    setI(0);
    onClose?.();
  };

  return (
    <Sheet open={open} onClose={finish} size="sm" className="tour">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={i}
          className="tour__slide"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          <div className="tour__art">
            <Pingo size={132} mood={slide.mood} wave={slide.wave} outfit={slide.outfit} />
          </div>
          <h2 className="tour__title">{slide.title}</h2>
          <p className="tour__text">{slide.text}</p>
        </motion.div>
      </AnimatePresence>
      <div className="tour__dots" aria-hidden="true">
        {slides.map((s, idx) => (
          <span key={s.title} className={idx === i ? 'is-active' : ''} />
        ))}
      </div>
      <div className="tour__actions">
        <Button variant="ghost" onClick={finish}>
          {t('Пропустить')}
        </Button>
        <Button variant="dark" data-autofocus iconRight={last ? undefined : ArrowRightIcon} onClick={() => (last ? finish() : setI(i + 1))}>
          {last ? t('Начать') : t('Дальше')}
        </Button>
      </div>
    </Sheet>
  );
}
