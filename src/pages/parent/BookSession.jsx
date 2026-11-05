import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, ChatCircleDotsIcon, PaperPlaneTiltIcon, WarningIcon } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { freshSlots, useSpecialist } from '../../hooks/useCatalog';
import { useChildren } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { BOOKING_HORIZON_DAYS, FORMATS } from '../../lib/constants';
import { matchChild } from '../../lib/matching';
import { groupSlotsByDay } from '../../lib/slots';
import {
  addDays,
  ageFromBirthDate,
  cx,
  fmtAge,
  fmtDay,
  fmtRange,
  fmtShortDate,
  fmtWeekday,
  parseDateKey,
  plural,
  startOfDay,
  toDateKey,
} from '../../lib/utils';
import { createBooking } from '../../services/bookings';
import { conversationIdFor } from '../../services/chat';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { Pingo } from '../../components/Pingo';
import { Button, ButtonLink, Field, Segmented, Textarea } from '../../components/ui';
import { t } from '../../i18n';

export default function BookSession() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(30_000);
  const entry = useSpecialist(id);
  const children = useChildren(user.id);
  const [childId, setChildId] = useState(null);
  const [day, setDay] = useState(null);
  const [slotStart, setSlotStart] = useState(() => Number(params.get('start')) || null);
  const [format, setFormat] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const slots = useMemo(() => (entry?.data ? freshSlots(entry.slots, now) : []), [entry, now]);
  const byDay = useMemo(() => groupSlotsByDay(slots), [slots]);
  const days = useMemo(() => {
    const first = startOfDay(now);
    return Array.from({ length: BOOKING_HORIZON_DAYS }, (_, i) => {
      const d = addDays(first, i);
      const key = toDateKey(d);
      return { key, date: d.getTime(), count: byDay.get(key)?.length ?? 0 };
    });
  }, [byDay, now]);

  if (entry === undefined || !children) return <div className="page page--loading" />;
  if (!entry?.data) return <EmptyState pingo title={t('Анкета недоступна')} action={<ButtonLink to="/parent/specialists">{t('К каталогу')}</ButtonLink>} />;
  if (!children.length) {
    return (
      <div className="page">
        <PageHeader back={`/parent/specialists/${id}`} title={t('Запись на занятие')} />
        <EmptyState
          pingo
          title={t('Сначала профиль ребёнка')}
          text={t('Специалисту важно знать, с кем он будет заниматься: возраст, особенности и цели.')}
          action={<ButtonLink to="/parent/children/new">{t('Создать профиль')}</ButtonLink>}
        />
      </div>
    );
  }

  const { user: sp, data } = entry;
  const selectedChild = children.find((c) => c.id === (childId ?? user.activeChildId)) ?? children[0];
  const validStart = slots.some((s) => s.start === slotStart) ? slotStart : null;
  const selectedDay = day ?? (validStart ? toDateKey(validStart) : days.find((d) => d.count > 0)?.key);
  const daySlots = byDay.get(selectedDay) ?? [];
  const selectedFormat = format ?? data.formats[0];
  const match = matchChild(selectedChild, data);
  const chosen = slots.find((s) => s.start === validStart);

  if (created) {
    return (
      <div className="page booking-done">
        <motion.div
          className="booking-done__card"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        >
          <motion.div initial={{ y: 30, rotate: -10 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 10 }}>
            <Pingo size={130} mood="happy" wave />
          </motion.div>
          <h1 className="page-title">{t('Запрос отправлен!')}</h1>
          <p className="muted">
            {t('{name} получит уведомление и подтвердит запись. Статус — «Ожидает подтверждения», я сообщу, когда он изменится.', { name: sp.name })}
          </p>
          <div className="summary-card">
            <Avatar avatar={selectedChild.avatar} name={selectedChild.name} size={52} />
            <div>
              <strong>
                {fmtDay(created.start)}, {fmtRange(created.start, created.end)}
              </strong>
              <span>
                {selectedChild.name} · {sp.name} · {selectedFormat === 'online' ? t('онлайн') : t('очно')}
              </span>
            </div>
          </div>
          <div className="booking-done__actions">
            <ButtonLink to={`/parent/bookings/${created.id}`} variant="dark" size="lg" iconRight={ArrowRightIcon} block>
              {t('Открыть запись')}
            </ButtonLink>
            <ButtonLink to={`/parent/messages/${conversationIdFor(user.id, id)}`} variant="soft" size="lg" icon={ChatCircleDotsIcon} block>
              {t('Написать специалисту')}
            </ButtonLink>
          </div>
        </motion.div>
      </div>
    );
  }

  const submit = async () => {
    if (!chosen) {
      toast.error(t('Выберите время занятия'));
      return;
    }
    setBusy(true);
    try {
      const { booking } = await createBooking({
        parentId: user.id,
        childId: selectedChild.id,
        specialistId: id,
        start: chosen.start,
        format: selectedFormat,
        note,
      });
      setCreated(booking);
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast.error(e.message);
      setSlotStart(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page book">
      <PageHeader back={`/parent/specialists/${id}`} title={t('Запись на занятие')} subtitle={t('{name} · {sessionMinutes} минут', { name: sp.name, sessionMinutes: entry.sessionMinutes })} />

      <section className="book__section">
        <h2 className="book__label">{t('Для кого')}</h2>
        <div className="choice-row">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cx('choice', selectedChild.id === c.id && 'is-active')}
              aria-pressed={selectedChild.id === c.id}
              onClick={() => setChildId(c.id)}
            >
              <Avatar avatar={c.avatar} name={c.name} size={44} />
              <span>
                <strong>{c.name}</strong>
                <span>{fmtAge(ageFromBirthDate(c.birthDate))}</span>
              </span>
            </button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {!match.ageOk && (
            <motion.p className="inline-warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <WarningIcon size={18} weight="fill" />{' '}{t('{name} работает с детьми {ageMin}–{ageMax} лет. Запрос можно отправить, но специалист может отказаться.', { name: sp.name, ageMin: data.ageMin, ageMax: data.ageMax })}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {slots.length === 0 ? (
        <EmptyState
          pingo
          title={t('Свободных окон нет')}
          text={t('На ближайшие три недели всё занято. Напишите специалисту — возможно, появится время.')}
          action={<ButtonLink to={`/parent/specialists/${id}`}>{t('К анкете')}</ButtonLink>}
        />
      ) : (
        <>
          <section className="book__section">
            <h2 className="book__label">{t('Дата')}</h2>
            <div className="day-strip" role="listbox" aria-label={t('Дата')}>
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  role="option"
                  aria-selected={selectedDay === d.key}
                  disabled={!d.count}
                  className={cx('day', selectedDay === d.key && 'is-active')}
                  onClick={() => {
                    setDay(d.key);
                    setSlotStart(null);
                  }}
                >
                  {selectedDay === d.key && (
                    <motion.span layoutId="day-pill" className="day__pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                  )}
                  <span className="day__wd">{fmtWeekday(d.date)}</span>
                  <span className="day__num">{new Date(d.date).getDate()}</span>
                  <span className="day__count">{d.count ? `${d.count} ${plural(d.count, [t('окно'), t('окна'), t('окон')])}` : '—'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="book__section">
            <h2 className="book__label">{t('Время{p0}', { p0: selectedDay ? ` · ${fmtShortDate(parseDateKey(selectedDay))}` : '' })}</h2>
            <motion.div key={selectedDay} className="time-grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {daySlots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  className={cx('time', validStart === s.start && 'is-active')}
                  aria-pressed={validStart === s.start}
                  onClick={() => setSlotStart(s.start)}
                >
                  {fmtRange(s.start, s.end)}
                </button>
              ))}
            </motion.div>
          </section>

          {data.formats.length > 1 && (
            <section className="book__section">
              <h2 className="book__label">{t('Формат')}</h2>
              <Segmented
                value={selectedFormat}
                onChange={setFormat}
                options={FORMATS.map((f) => ({ ...f, hint: f.id === 'offline' ? `${data.city} · ${f.hint}` : f.hint }))}
                layoutId="book-format"
              />
            </section>
          )}

          <section className="book__section">
            <Field label={t('Заметка для специалиста')} optional counter={`${note.length}/500`}>
              <Textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('Что важно учесть на первом занятии? Например: боится громких звуков, любит машинки.')}
              />
            </Field>
          </section>

          <div className="book__bar">
            <div className="book__summary">
              {chosen ? (
                <>
                  <strong>
                    {fmtDay(chosen.start, now)}, {fmtRange(chosen.start, chosen.end)}
                  </strong>
                  <span>
                    {selectedChild.name} · {selectedFormat === 'online' ? t('онлайн') : t('очно, {city}', { city: data.city })}
                  </span>
                </>
              ) : (
                <span className="muted">{t('Выберите время занятия')}</span>
              )}
            </div>
            <Button variant="dark" size="lg" icon={PaperPlaneTiltIcon} onClick={submit} loading={busy} disabled={!chosen}>
              {t('Отправить запрос')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
