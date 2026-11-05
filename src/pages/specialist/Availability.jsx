import { useMemo, useState } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarPlusIcon, PlusIcon, RepeatIcon, XIcon } from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { SESSION_DURATIONS, WEEKDAYS } from '../../lib/constants';
import { generateSlots, groupSlotsByDay, isActiveBooking } from '../../lib/slots';
import { addDays, cx, fmtDay, fmtWeekday, parseDateKey, plural, startOfDay, toDateKey } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNow } from '../../hooks/useNow';
import { addAvailability, removeAvailability } from '../../services/availability';
import { setSessionMinutes } from '../../services/profiles';
import { PageHeader } from '../../components/PageHeader';
import { Sheet } from '../../components/Sheet';
import { Button, Chip, Field, Input, Segmented } from '../../components/ui';

const PRESETS = [
  { label: 'Утро', start: '09:00', end: '12:00' },
  { label: 'День', start: '13:00', end: '17:00' },
  { label: 'Вечер', start: '17:00', end: '20:00' },
];

function AddWindowSheet({ open, onClose, specialistId, initial }) {
  const toast = useToast();
  const [mode, setMode] = useState(initial.mode);
  const [days, setDays] = useState(initial.weekday != null ? [initial.weekday] : []);
  const [date, setDate] = useState(toDateKey(addDays(Date.now(), 1)));
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('13:00');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (mode === 'weekly') {
        if (!days.length) throw new Error('Выберите хотя бы один день недели');
        const errors = [];
        for (const weekday of days) {
          try {
            await addAvailability(specialistId, { type: 'weekly', weekday, start, end });
          } catch (e) {
            errors.push(`${WEEKDAYS.find((w) => w.id === weekday).short}: ${e.message}`);
          }
        }
        if (errors.length === days.length) throw new Error(errors[0]);
        if (errors.length) toast.info(`Часть окон не добавлена — ${errors.join('; ')}`);
        else toast.success('Окна добавлены');
      } else {
        await addAvailability(specialistId, { type: 'date', date, start, end });
        toast.success('Разовое окно добавлено');
      }
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Новое окно"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="dark" onClick={save} loading={busy}>
            Добавить
          </Button>
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        layoutId="avail-mode"
        options={[
          { id: 'weekly', label: 'Каждую неделю' },
          { id: 'date', label: 'Разовая дата' },
        ]}
      />
      {mode === 'weekly' ? (
        <Field label="Дни недели" hint="Можно выбрать несколько">
          <div className="chips chips--wrap">
            {WEEKDAYS.map((w) => (
              <Chip
                key={w.id}
                active={days.includes(w.id)}
                onClick={() => setDays((d) => (d.includes(w.id) ? d.filter((x) => x !== w.id) : [...d, w.id]))}
              >
                {w.short}
              </Chip>
            ))}
          </div>
        </Field>
      ) : (
        <Field label="Дата" htmlFor="avail-date">
          <Input id="avail-date" type="date" min={toDateKey(Date.now())} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}
      <Field label="Время">
        <div className="chips chips--wrap chips--sm">
          {PRESETS.map((p) => (
            <Chip
              key={p.label}
              active={start === p.start && end === p.end}
              onClick={() => {
                setStart(p.start);
                setEnd(p.end);
              }}
            >
              {p.label} {p.start}–{p.end}
            </Chip>
          ))}
        </div>
        <div className="time-range">
          <Input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} aria-label="Начало" />
          <span>—</span>
          <Input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Конец" />
        </div>
      </Field>
    </Sheet>
  );
}

function WindowChip({ r, onRemove }) {
  return (
    <motion.span className="window-chip" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
      {r.start}–{r.end}
      <button type="button" aria-label={`Удалить окно ${r.start}–${r.end}`} onClick={() => onRemove(r.id)}>
        <XIcon size={14} weight="bold" />
      </button>
    </motion.span>
  );
}

export default function Availability() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow(60_000);
  const rules = useLiveQuery(() => db.availability.where('specialistId').equals(user.id).toArray(), [user.id]);
  const profile = useLiveQuery(() => db.profiles.get(user.id), [user.id]);
  const bookings = useLiveQuery(() => db.bookings.where('specialistId').equals(user.id).toArray(), [user.id]);
  const [sheet, setSheet] = useState({ open: false, mode: 'weekly', weekday: null, key: 0 });
  const openSheet = (mode, weekday = null) => setSheet((s) => ({ open: true, mode, weekday, key: s.key + 1 }));

  const preview = useMemo(() => {
    if (!rules || !profile || !bookings) return [];
    const slots = generateSlots({
      rules,
      busy: bookings.filter(isActiveBooking),
      duration: profile.sessionMinutes,
      from: now,
      days: 7,
    });
    const byDay = groupSlotsByDay(slots);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(startOfDay(now), i);
      return { key: toDateKey(d), date: d.getTime(), count: byDay.get(toDateKey(d))?.length ?? 0 };
    });
  }, [rules, profile, bookings, now]);

  if (!rules || !profile || !bookings) return <div className="page page--loading" />;

  const weekly = WEEKDAYS.map((w) => ({
    ...w,
    windows: rules.filter((r) => r.type === 'weekly' && r.weekday === w.id).sort((a, b) => a.start.localeCompare(b.start)),
  }));
  const today = toDateKey(now);
  const dated = rules.filter((r) => r.type === 'date' && r.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const total = preview.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...preview.map((d) => d.count));

  const remove = async (id) => {
    await removeAvailability(id);
    toast.info('Окно удалено. Уже созданные записи сохраняются.');
  };

  return (
    <div className="page availability">
      <PageHeader
        title="Расписание"
        subtitle="Родители видят свободное время на 3 недели вперёд и записываются в эти окна."
        actions={
          <Button variant="dark" icon={PlusIcon} onClick={() => openSheet('weekly')}>
            Окно
          </Button>
        }
      />

      <section className="card-section">
        <h2>Длительность занятия</h2>
        <Segmented
          value={profile.sessionMinutes}
          onChange={(m) => setSessionMinutes(user.id, m).then(() => toast.success(`Теперь занятие длится ${m} минут`))}
          options={SESSION_DURATIONS.map((m) => ({ id: m, label: `${m} мин` }))}
          layoutId="session-len"
        />
      </section>

      <section className="card-section">
        <h2>
          <RepeatIcon size={22} weight="bold" /> Каждую неделю
        </h2>
        <ul className="week-list">
          {weekly.map((w) => (
            <li key={w.id} className={cx('week-row', !w.windows.length && 'is-empty')}>
              <span className="week-row__day">{w.short}</span>
              <div className="week-row__windows">
                <AnimatePresence initial={false}>
                  {w.windows.map((r) => (
                    <WindowChip key={r.id} r={r} onRemove={remove} />
                  ))}
                </AnimatePresence>
                {!w.windows.length && <span className="muted small">выходной</span>}
              </div>
              <button type="button" className="week-row__add" aria-label={`Добавить окно: ${w.label}`} onClick={() => openSheet('weekly', w.id)}>
                <PlusIcon size={18} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-section">
        <div className="card-section__head">
          <h2>
            <CalendarPlusIcon size={22} weight="bold" /> Разовые даты
          </h2>
          <Button size="sm" variant="soft" icon={PlusIcon} onClick={() => openSheet('date')}>
            Дата
          </Button>
        </div>
        {dated.length === 0 ? (
          <p className="muted">Добавьте отдельный день, если хотите поработать вне обычного графика.</p>
        ) : (
          <ul className="dated-list">
            <AnimatePresence initial={false}>
              {dated.map((r) => (
                <motion.li key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                  <strong>{fmtDay(parseDateKey(r.date).getTime(), now)}</strong>
                  <WindowChip r={r} onRemove={remove} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <section className="card-section">
        <h2>Так вас увидят родители</h2>
        <p className="muted small">
          На ближайшей неделе: {total} {plural(total, ['свободное окно', 'свободных окна', 'свободных окон'])} по {profile.sessionMinutes} минут
          {profile.published ? '' : ' (появятся в каталоге после одобрения анкеты)'}.
        </p>
        <div className="week-preview">
          {preview.map((d, i) => (
            <div key={d.key} className="week-preview__col">
              <div className="week-preview__bar">
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.count / max) * 100}%` }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 140, damping: 18 }}
                />
              </div>
              <strong>{d.count}</strong>
              <span>{i === 0 ? 'сег' : fmtWeekday(d.date)}</span>
            </div>
          ))}
        </div>
      </section>

      <AddWindowSheet
        key={sheet.key}
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        specialistId={user.id}
        initial={sheet}
      />
    </div>
  );
}
