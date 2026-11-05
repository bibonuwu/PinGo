import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircleIcon,
  CloudCheckIcon,
  FileTextIcon,
  GraduationCapIcon,
  LockIcon,
  PaperPlaneTiltIcon,
  TrashIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { db } from '../../lib/db';
import {
  CATEGORIES,
  FORMATS,
  LANGUAGES,
  MAX_SPECIALIZATIONS,
  PROFILE_KINDS,
  SPECIALIZATIONS,
} from '../../lib/constants';
import { cx, fmtBytes } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { updateAccount } from '../../services/auth';
import { ACCEPTED_FILES, deleteFile, openFile, saveFiles } from '../../services/files';
import { changedFields, profileIssues, saveDraft, submitProfile, trainingProgress, withdrawProfile } from '../../services/profiles';
import { AvatarPicker } from '../../components/Avatar';
import { PageHeader } from '../../components/PageHeader';
import { PingoGuide } from '../../components/Pingo';
import { Button, Checkbox, Chip, Field, Input, Segmented, Select, Textarea } from '../../components/ui';
import { t } from '../../i18n';

const AGES = Array.from({ length: 18 }, (_, i) => i + 1);

export default function ProfileEditor() {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const profile = useLiveQuery(() => db.profiles.get(user.id), [user.id]);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState('idle'); // idle | saving | saved
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (profile && !draft) setDraft(profile.draft);
  }, [profile, draft]);

  // Автосохранение черновика через полсекунды после изменения.
  useEffect(() => {
    if (!draft || !dirty.current) return undefined;
    setSaved('saving');
    const t = setTimeout(async () => {
      try {
        await saveDraft(user.id, draft);
        dirty.current = false;
        setSaved('saved');
      } catch (e) {
        setSaved('idle');
        toast.error(e.message);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [draft, user.id, toast]);

  // Ушли со страницы раньше, чем сработало автосохранение (например, сразу открыли обучение), — сохраняем сейчас.
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(
    () => () => {
      if (dirty.current && latest.current) saveDraft(user.id, latest.current).catch(() => {});
    },
    [user.id],
  );

  // Прокручиваем к якорю один раз, когда анкета загрузилась, — а не после каждой правки.
  const loaded = Boolean(draft);
  useEffect(() => {
    if (location.hash && loaded) document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [location.hash, loaded]);

  if (!profile || !draft) return <div className="page page--loading" />;

  const locked = profile.status === 'pending';
  const set = (patch) => {
    if (locked) return;
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };
  const issues = profileIssues({ ...profile, draft });
  const training = trainingProgress(profile);
  const changes = changedFields({ ...profile, draft });
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async () => {
    setBusy(true);
    try {
      await saveDraft(user.id, draft);
      dirty.current = false;
      await submitProfile(user.id);
      toast.success(t('Анкета отправлена на модерацию. Я сообщу о решении!'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    await withdrawProfile(user.id);
    toast.info(t('Заявка отозвана — можно редактировать'));
  };

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const metas = await saveFiles(user.id, files, draft.documents.length);
      set({ documents: [...draft.documents, ...metas] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeDoc = async (doc) => {
    set({ documents: draft.documents.filter((d) => d.id !== doc.id) });
    // Файл удаляем, только если он не входит в опубликованную версию анкеты.
    if (!profile.published?.documents?.some((d) => d.id === doc.id)) await deleteFile(doc).catch((e) => toast.error(e.message));
  };

  return (
    <div className="page form-page editor">
      <PageHeader
        back="/specialist/profile"
        title={t('Анкета')}
        actions={
          <AnimatePresence mode="wait">
            {saved !== 'idle' && (
              <motion.span key={saved} className="autosave" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <CloudCheckIcon size={18} weight="bold" /> {saved === 'saving' ? t('Сохраняю…') : t('Сохранено')}
              </motion.span>
            )}
          </AnimatePresence>
        }
      />

      {welcome && profile.status === 'draft' && (
        <PingoGuide outfit="scarf" mood="happy" wave bubbleKey="welcome">
          {t('Добро пожаловать в Pingo! Заполните анкету — я сохраняю всё автоматически. Затем пройдите короткое обучение и отправьте анкету на модерацию.')}
        </PingoGuide>
      )}

      {locked && (
        <div className="notice notice--warning">
          <LockIcon size={22} weight="fill" />
          <div>
            <strong>{t('Анкета на проверке')}</strong>
            <span>{t('Чтобы что-то изменить, отзовите заявку — потом отправите её снова.')}</span>
          </div>
          <Button size="sm" variant="dark" onClick={withdraw}>
            {t('Отозвать')}
          </Button>
        </div>
      )}
      {profile.status === 'rejected' && profile.rejectionReason && (
        <div className="notice notice--danger">
          <WarningCircleIcon size={22} weight="fill" />
          <div>
            <strong>{t('Модератор вернул анкету')}</strong>
            <span>{profile.rejectionReason}</span>
          </div>
        </div>
      )}
      {profile.status === 'approved' && changes.length > 0 && (
        <div className="notice">
          <PaperPlaneTiltIcon size={22} weight="fill" />
          <div>
            <strong>{t('Есть неопубликованные изменения')}</strong>
            <span>{t('{join}. Отправьте их на модерацию — до проверки родители видят прежнюю версию.', { join: changes.join(', ') })}</span>
          </div>
        </div>
      )}

      <fieldset disabled={locked} className="editor__fields">
        <section className="card-section">
          <h2>{t('Кто вы')}</h2>
          <Segmented value={draft.kind} onChange={(kind) => set({ kind })} options={PROFILE_KINDS} layoutId="kind" />
          <Field label={t('Аватар')} hint={t('Пингвин вместо фото — так спокойнее детям')}>
            <AvatarPicker value={user.avatar} onChange={(avatar) => updateAccount(user.id, { avatar })} size={60} />
          </Field>
        </section>

        <section className="card-section">
          <h2>{t('О себе')}</h2>
          <Field label={t('Заголовок анкеты')} counter={`${draft.title.length}/80`} hint={t('Коротко: кто вы и с чем помогаете')}>
            <Input
              value={draft.title}
              maxLength={80}
              placeholder={t('Например: Логопед для малышей с задержкой речи')}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <Field label={t('Описание')} counter={`${draft.description.length}/1500`} hint={t('Как проходят занятия, с какими запросами работаете (от 60 символов)')}>
            <Textarea
              rows={6}
              maxLength={1500}
              value={draft.description}
              placeholder={t('Расскажите родителям о своём подходе')}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
        </section>

        <section className="card-section">
          <h2>{t('Опыт')}</h2>
          <Field label={t('Стаж работы с детьми, лет')}>
            <Input
              type="number"
              min={0}
              max={50}
              inputMode="numeric"
              value={draft.experienceYears}
              onChange={(e) => set({ experienceYears: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
            />
          </Field>
          <Field
            label={t('Образование и опыт')}
            optional={draft.kind === 'volunteer'}
            counter={`${draft.experienceText.length}/800`}
            hint={draft.kind === 'specialist' ? t('Вуз, курсы, места работы (от 20 символов)') : t('Учёба, волонтёрский опыт')}
          >
            <Textarea rows={4} maxLength={800} value={draft.experienceText} onChange={(e) => set({ experienceText: e.target.value })} />
          </Field>
        </section>

        <section className="card-section">
          <h2>{t('Специализации')}</h2>
          <p className="muted small">
            {t('Выберите до {MAX_SPECIALIZATIONS} из 12 · выбрано {length}', { MAX_SPECIALIZATIONS, length: draft.specializations.length })}
          </p>
          {CATEGORIES.filter((c) => c.id !== 'volunteers').map((c) => (
            <div key={c.id} className="spec-group">
              <span className="spec-group__label">
                <span className="chip__dot" style={{ background: c.color }} /> {c.label}
              </span>
              <div className="chips chips--wrap">
                {SPECIALIZATIONS.filter((s) => s.category === c.id).map((s) => {
                  const active = draft.specializations.includes(s.id);
                  return (
                    <Chip
                      key={s.id}
                      active={active}
                      disabled={!active && draft.specializations.length >= MAX_SPECIALIZATIONS}
                      onClick={() => set({ specializations: toggle(draft.specializations, s.id) })}
                    >
                      {s.label}
                    </Chip>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="card-section">
          <h2>{t('Формат и возраст')}</h2>
          <Field label={t('Возраст детей')}>
            <div className="time-range">
              <Select value={draft.ageMin} onChange={(e) => set({ ageMin: Number(e.target.value) })} aria-label={t('От')}>
                {AGES.map((a) => (
                  <option key={a} value={a}>
                    {t('от {a}', { a })}
                  </option>
                ))}
              </Select>
              <span>—</span>
              <Select value={draft.ageMax} onChange={(e) => set({ ageMax: Number(e.target.value) })} aria-label={t('До')}>
                {AGES.map((a) => (
                  <option key={a} value={a}>
                    {t('до {a} лет', { a })}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
          <Field label={t('Формат занятий')}>
            <Segmented multiple value={draft.formats} onChange={(formats) => set({ formats })} options={FORMATS} />
          </Field>
          <AnimatePresence initial={false}>
            {draft.formats.includes('offline') && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <Field label={t('Город для очных занятий')}>
                  <Input value={draft.city} maxLength={60} placeholder={t('Например, Алматы')} onChange={(e) => set({ city: e.target.value })} />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
          <Field label={t('Языки занятий')}>
            <div className="chips chips--wrap">
              {LANGUAGES.map((l) => (
                <Chip key={l.id} active={draft.languages.includes(l.id)} onClick={() => set({ languages: toggle(draft.languages, l.id) })}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </Field>
        </section>

        <section className="card-section">
          <h2>{t('Документы')}</h2>
          <p className="muted small">
            {t('Диплом, сертификаты или справка о волонтёрстве. Их видит только модератор. PDF или фото до 5 МБ.')}
          </p>
          {draft.documents.length > 0 && (
            <ul className="docs">
              {draft.documents.map((d) => (
                <li key={d.id}>
                  <button type="button" className="docs__open" onClick={() => openFile(d).catch((e) => toast.error(e.message))}>
                    <FileTextIcon size={22} weight="fill" />
                    <span>
                      <strong>{d.name}</strong>
                      <span>{fmtBytes(d.size)}</span>
                    </span>
                  </button>
                  <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={t('Удалить {name}', { name: d.name })} onClick={() => removeDoc(d)}>
                    <TrashIcon size={18} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input ref={fileRef} type="file" accept={ACCEPTED_FILES} multiple hidden onChange={(e) => upload(e.target.files)} />
          <Button variant="soft" icon={UploadSimpleIcon} loading={uploading} onClick={() => fileRef.current?.click()}>
            {t('Прикрепить файлы')}
          </Button>
        </section>

        <section className="card-section" id="agreements">
          <h2>{t('Подтверждения')}</h2>
          <Checkbox checked={draft.agreements.truth} onChange={(v) => set({ agreements: { ...draft.agreements, truth: v } })}>
            {t('Подтверждаю, что данные в анкете достоверны')}
          </Checkbox>
          <Checkbox checked={draft.agreements.safety} onChange={(v) => set({ agreements: { ...draft.agreements, safety: v } })}>
            {t('Обязуюсь соблюдать правила безопасности детей и общаться с семьями только через Pingo')}
          </Checkbox>
        </section>
      </fieldset>

      {/* Обучение — последний шаг перед отправкой: из него возвращаемся сюда же, к кнопке отправки. */}
      <section className="card-section" id="training">
        <h2>
          <GraduationCapIcon size={22} weight="fill" />{' '}{t('Обучение Pingo')}
        </h2>
        <p className="muted small">
          {training.complete
            ? t('Все модули пройдены — спасибо!')
            : t('Пройдено {done} из {total}. Без обучения анкету нельзя отправить.', { done: training.done, total: training.total })}
        </p>
        <Link
          to="/specialist/training"
          state={{ fromEditor: true }}
          // Запоминаем место в истории: «Назад» из обучения вернёт прямо к этому блоку, а не в начало анкеты.
          onClick={() => navigate({ search: location.search, hash: '#training' }, { replace: true })}
          className={cx('btn', training.complete ? 'btn--soft' : 'btn--primary')}
        >
          {training.complete ? (
            <>
              <CheckCircleIcon size={20} weight="fill" /> <span>{t('Повторить материалы')}</span>
            </>
          ) : (
            <span>{t('Пройти обучение')}</span>
          )}
        </Link>
      </section>

      {!locked && (
        <div className="submit-box">
          {issues.length > 0 ? (
            <ul className="issues">
              {issues.map((i) => (
                <li key={i.text}>{i.text}</li>
              ))}
            </ul>
          ) : (
            <p className="submit-box__ok">
              <CheckCircleIcon size={20} weight="fill" />{' '}{t('Всё готово к модерации')}
            </p>
          )}
          <Button
            variant="dark"
            size="lg"
            icon={PaperPlaneTiltIcon}
            onClick={submit}
            loading={busy}
            disabled={issues.length > 0 || (profile.status === 'approved' && changes.length === 0)}
          >
            {profile.status === 'approved' ? t('Отправить изменения') : t('Отправить на модерацию')}
          </Button>
        </div>
      )}
    </div>
  );
}
