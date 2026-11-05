import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { LEARNING_STYLE_MAP, NEED_MAP, describeAccessibility, suggestAccessibility } from '../../lib/constants';
import { ageFromBirthDate, fmtAge } from '../../lib/utils';
import { childIssues, createChild, emptyChild } from '../../services/children';
import { AccessibilityForm } from '../../components/AccessibilityForm';
import { Avatar, AvatarPicker } from '../../components/Avatar';
import { AboutFields, GoalsFields, NeedsFields, StyleFields } from '../../components/ChildForm';
import { Confetti } from '../../components/Decor';
import { Pingo, PingoGuide } from '../../components/Pingo';
import { Button, ButtonLink, Checkbox, IconButton, ProgressBar } from '../../components/ui';
import { t } from '../../i18n';

const STEPS = [
  { id: 'avatar', title: t('Аватар') },
  { id: 'about', title: t('Имя и возраст') },
  { id: 'needs', title: t('Потребности') },
  { id: 'style', title: t('Стиль обучения') },
  { id: 'a11y', title: t('Доступность') },
  { id: 'goals', title: t('Цели') },
];

function guideText(step) {
  switch (step) {
    case 'avatar':
      return t('Привет! Я Pingo — ваш гид. Давайте создадим профиль ребёнка. Для начала выберите аватар — его увидит ребёнок 🐧');
    case 'about':
      return t('Как зовут ребёнка и когда у него день рождения?');
    case 'needs':
      return t('С чем нужна поддержка? Можно выбрать несколько вариантов. Диагноз указывать необязательно.');
    case 'style':
      return t('Как ребёнку легче учиться? Специалист подготовит занятия под этот стиль.');
    case 'a11y':
      return t('Настроим Pingo под ребёнка: я уже подобрал настройки по выбранным особенностям — их можно изменить.');
    default:
      return t('Почти готово! Расскажите о целях и о том, что важно знать специалисту, — так первое занятие пройдёт спокойнее.');
  }
}

const slide = {
  enter: (dir) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir * -48 }),
};

export default function ChildWizard({ onboarding = false }) {
  useThemeColor('#FFFFFF');
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [data, setData] = useState(emptyChild);
  const [a11yTouched, setA11yTouched] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const current = STEPS[step];
  const suggestion = useMemo(() => suggestAccessibility(data.needs), [data.needs]);
  const set = (patch) => {
    setData((d) => ({ ...d, ...patch }));
    setErrors({});
  };

  const go = (n) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const next = () => {
    if (current.id === 'about' || current.id === 'needs') {
      const all = childIssues(data);
      const relevant =
        current.id === 'about' ? { name: all.name, birthDate: all.birthDate } : { needsOther: all.needsOther };
      Object.keys(relevant).forEach((k) => relevant[k] === undefined && delete relevant[k]);
      if (Object.keys(relevant).length) {
        setErrors(relevant);
        return;
      }
    }
    if (STEPS[step + 1]?.id === 'a11y' && !a11yTouched) setData((d) => ({ ...d, accessibility: suggestion }));
    go(step + 1);
  };

  const back = () => (step > 0 ? go(step - 1) : navigate(onboarding ? '/parent' : -1));

  const submit = async () => {
    if (!consent) {
      setErrors({ consent: true });
      toast.error(t('Подтвердите согласие законного представителя'));
      return;
    }
    setSaving(true);
    try {
      setCreated(await createChild(user.id, data, { consent }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    const age = ageFromBirthDate(created.birthDate);
    return (
      <div className="wizard wizard--done">
        <Confetti />
        <motion.div
          className="wizard__done"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <motion.div animate={{ y: [0, -18, 0] }} transition={{ duration: 0.7, repeat: 2 }}>
            <Pingo size={140} mood="happy" wave />
          </motion.div>
          <h1 className="page-title">{t('Профиль готов!')}</h1>
          <p className="muted">{t('Теперь я буду подбирать специалистов по этому профилю и подстрою приложение под ребёнка.')}</p>
          <div className="summary-card">
            <Avatar avatar={created.avatar} name={created.name} size={64} />
            <div>
              <strong>
                {created.name}, {fmtAge(age)}
              </strong>
              <span>{created.needs.map((n) => NEED_MAP[n]?.label).join(', ') || t('Без указания особенностей')}</span>
              {created.learningStyles.length > 0 && (
                <span>{t('Учится:')}{' '}{created.learningStyles.map((s) => LEARNING_STYLE_MAP[s]?.label.toLowerCase()).join(', ')}</span>
              )}
              {describeAccessibility(created.accessibility).length > 0 && (
                <span>{t('Интерфейс: {join}', { join: describeAccessibility(created.accessibility).join(', ') })}</span>
              )}
            </div>
          </div>
          <div className="wizard__done-actions">
            <ButtonLink to="/parent/specialists" variant="primary" size="lg" icon={MagnifyingGlassIcon} block>
              {t('Найти специалиста')}
            </ButtonLink>
            <ButtonLink to="/parent" variant="soft" size="lg" block>
              {t('На главную')}
            </ButtonLink>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="wizard">
      <header className="wizard__top">
        <IconButton icon={ArrowLeftIcon} label={t('Назад')} onClick={back} />
        <div className="wizard__progress">
          <span className="wizard__step">
            {t('Шаг {p0} из {length} · {title}', { p0: step + 1, length: STEPS.length, title: current.title })}
          </span>
          <ProgressBar value={(step + 1) / STEPS.length} />
        </div>
        {onboarding ? (
          <Button variant="ghost" size="sm" onClick={() => navigate('/parent', { replace: true })}>
            {t('Позже')}
          </Button>
        ) : (
          <IconButton icon={XIcon} label={t('Закрыть')} onClick={() => navigate('/parent/profile')} />
        )}
      </header>

      <div className="wizard__body">
        <aside className="wizard__guide">
          <PingoGuide bubbleKey={current.id} mood={current.id === 'goals' ? 'happy' : current.id === 'a11y' ? 'wink' : 'open'} wave={step === 0} size={96}>
            {guideText(current.id)}
          </PingoGuide>
          <div className="wizard__preview">
            <Avatar avatar={data.avatar} name={data.name} size={56} />
            <div>
              <strong>{data.name.trim() || t('Имя ребёнка')}</strong>
              <span>{data.birthDate ? fmtAge(ageFromBirthDate(data.birthDate)) : t('Возраст')}</span>
            </div>
          </div>
        </aside>

        <div className="wizard__content">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.section
              key={current.id}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="wizard__section"
            >
              <h1 className="wizard__title">{current.title}</h1>
              {current.id === 'avatar' && <AvatarPicker value={data.avatar} onChange={(avatar) => set({ avatar })} />}
              {current.id === 'about' && <AboutFields data={data} set={set} errors={errors} />}
              {current.id === 'needs' && <NeedsFields data={data} set={set} errors={errors} />}
              {current.id === 'style' && <StyleFields data={data} set={set} />}
              {current.id === 'a11y' && (
                <AccessibilityForm
                  value={data.accessibility}
                  suggestion={suggestion}
                  suggestionFor={data.name.trim() || undefined}
                  onChange={(accessibility) => {
                    setA11yTouched(true);
                    set({ accessibility });
                  }}
                />
              )}
              {current.id === 'goals' && (
                <>
                  <GoalsFields data={data} set={set} />
                  <Checkbox checked={consent} onChange={setConsent} error={errors.consent}>
                    {t('Я родитель или законный представитель ребёнка и даю согласие на обработку его данных в Pingo')}
                  </Checkbox>
                </>
              )}
            </motion.section>
          </AnimatePresence>
        </div>
      </div>

      <footer className="wizard__footer">
        <Button variant="soft" size="lg" onClick={back}>
          {step === 0 ? (onboarding ? t('Позже') : t('Отмена')) : t('Назад')}
        </Button>
        {current.id === 'goals' ? (
          <Button variant="dark" size="lg" icon={CheckIcon} onClick={submit} loading={saving}>
            {t('Создать профиль')}
          </Button>
        ) : (
          <Button variant="dark" size="lg" iconRight={ArrowRightIcon} onClick={next}>
            {current.id === 'needs' && data.needs.length === 0 ? t('Пропустить') : t('Далее')}
          </Button>
        )}
      </footer>
    </div>
  );
}
