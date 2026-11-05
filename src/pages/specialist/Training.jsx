import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretDownIcon, CheckCircleIcon, ClockIcon, GraduationCapIcon } from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { TRAINING_MODULES } from '../../lib/constants';
import { cx } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { completeTrainingModule, trainingProgress } from '../../services/profiles';
import { Confetti } from '../../components/Decor';
import { PageHeader } from '../../components/PageHeader';
import { Pingo } from '../../components/Pingo';
import { Button, ProgressBar } from '../../components/ui';
import { t } from '../../i18n';

// Обучение из концепции: инклюзия, этика, безопасность детей, нарушения развития, правила занятий.
export default function Training() {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useLiveQuery(() => db.profiles.get(user.id), [user.id]);
  const [open, setOpen] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const doneRef = useRef(null);

  useEffect(() => {
    if (celebrate) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [celebrate]);

  if (!profile) return <div className="page page--loading" />;
  const progress = trainingProgress(profile);
  const firstOpen = open ?? TRAINING_MODULES.find((m) => !profile.trainingDone.includes(m.id))?.id;

  // Открыли из анкеты — возвращаемся назад по истории, к блоку обучения рядом с кнопкой отправки.
  const backToEditor = () => {
    if (location.state?.fromEditor && window.history.state?.idx > 0) navigate(-1);
    else navigate('/specialist/profile/edit#training');
  };

  const complete = async (id) => {
    try {
      await completeTrainingModule(user.id, id);
      const next = TRAINING_MODULES.find((m) => m.id !== id && !profile.trainingDone.includes(m.id));
      if (next) setOpen(next.id);
      else {
        setCelebrate(true);
        toast.success(t('Обучение пройдено! Вернитесь к анкете и отправьте её на модерацию.'));
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="page training">
      {celebrate && <Confetti />}
      <PageHeader
        back={location.state?.fromEditor ? '/specialist/profile/edit#training' : '/specialist/profile'}
        title={t('Обучение Pingo')}
        subtitle={t('Пять коротких модулей о безопасности и бережном общении. Без них анкету нельзя отправить на модерацию.')}
      />
      <div className="training__progress">
        <GraduationCapIcon size={28} weight="fill" />
        <div>
          <strong>
            {t('{done} из {total} модулей', { done: progress.done, total: progress.total })}
          </strong>
          <ProgressBar value={progress.done / progress.total} />
        </div>
      </div>

      <ol className="modules">
        {TRAINING_MODULES.map((m, i) => {
          const done = profile.trainingDone.includes(m.id);
          const expanded = firstOpen === m.id;
          return (
            <motion.li
              key={m.id}
              className={cx('module', done && 'is-done', expanded && 'is-open')}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <button type="button" className="module__head" aria-expanded={expanded} onClick={() => setOpen(expanded ? '' : m.id)}>
                <span className="module__num">{done ? <CheckCircleIcon size={26} weight="fill" /> : i + 1}</span>
                <span className="module__title">
                  <strong>{m.title}</strong>
                  <span>
                    <ClockIcon size={14} weight="bold" />{' '}{t('{minutes} мин', { minutes: m.minutes })}
                  </span>
                </span>
                <CaretDownIcon size={20} weight="bold" className="module__caret" />
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div className="module__body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <ul>
                      {m.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    {done ? (
                      <p className="module__done">
                        <CheckCircleIcon size={18} weight="fill" />{' '}{t('Модуль пройден')}
                      </p>
                    ) : (
                      <Button variant="dark" onClick={() => complete(m.id)}>
                        {t('Я изучил(а) модуль')}
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>

      {progress.complete && (
        <motion.div ref={doneRef} className="training__done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Pingo size={96} mood="happy" outfit="glasses" />
          <div>
            <strong>{t('Обучение пройдено 🎓')}</strong>
            <p>{t('Спасибо, что заботитесь о безопасности детей.')}</p>
            <Button variant="primary" onClick={backToEditor}>
              {t('Вернуться к анкете')}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
