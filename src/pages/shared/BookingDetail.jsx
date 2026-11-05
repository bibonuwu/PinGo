import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  CalendarXIcon,
  ChatCircleDotsIcon,
  CheckIcon,
  ClipboardTextIcon,
  HourglassMediumIcon,
  MapPinIcon,
  StarIcon,
  VideoCameraIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBooking } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { CANCEL_TEMPLATES, DECLINE_TEMPLATES, LEARNING_STYLE_MAP, NEED_MAP, describeAccessibility } from '../../lib/constants';
import {
  ageFromBirthDate,
  cx,
  fmtAge,
  fmtCountdown,
  fmtDay,
  fmtDayTime,
  fmtRange,
  fmtShortDate,
  fmtWeekday,
} from '../../lib/utils';
import {
  addReview,
  addSessionReport,
  cancelBooking,
  confirmBooking,
  declineBooking,
  displayStatus,
  roomState,
  roomWindow,
} from '../../services/bookings';
import { conversationIdFor } from '../../services/chat';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ReasonDialog } from '../../components/Sheet';
import { Button, ButtonLink, Field, StarInput, Stars, StatusBadge, Textarea } from '../../components/ui';

function RoomBlock({ booking, now }) {
  const room = roomState(booking, now);
  const { opensAt } = roomWindow(booking);
  if (room === 'unavailable' || room === 'offline') return null;
  if (room === 'open') {
    return (
      <motion.div className="room-block room-block--open" initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <span className="live-dot" aria-hidden="true" />
        <div>
          <strong>Видеокомната открыта</strong>
          <span>Занятие начнётся {fmtDayTime(booking.start, now).toLowerCase()}. Проверьте камеру и звук заранее.</span>
        </div>
        <ButtonLink to={`/room/${booking.id}`} variant="dark" icon={VideoCameraIcon}>
          Войти
        </ButtonLink>
      </motion.div>
    );
  }
  const text =
    room === 'waiting'
      ? `Откроется за 15 минут до начала — через ${fmtCountdown(opensAt - now)}`
      : room === 'unconfirmed'
        ? 'Станет доступна, когда специалист подтвердит запись'
        : 'Занятие завершено — комната закрыта';
  return (
    <div className="room-block">
      {room === 'ended' ? <VideoCameraIcon size={24} weight="bold" /> : <HourglassMediumIcon size={24} weight="bold" />}
      <div>
        <strong>Видеокомната</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function Timeline({ b, now, viewer }) {
  const status = displayStatus(b, now);
  const items = [{ at: b.createdAt, text: 'Запрос отправлен', tone: 'done' }];
  if (b.confirmedAt) items.push({ at: b.confirmedAt, text: 'Подтверждено специалистом', tone: 'done' });
  if (b.status === 'declined') items.push({ at: b.updatedAt, text: `Отклонено${b.statusReason ? `: ${b.statusReason}` : ''}`, tone: 'bad' });
  if (b.status === 'cancelled') {
    const who = b.cancelledBy === b.parentId ? 'родителем' : 'специалистом';
    items.push({ at: b.updatedAt, text: `Отменено ${who}${b.statusReason ? `: ${b.statusReason}` : ''}`, tone: 'bad' });
  }
  if (status === 'expired') items.push({ at: b.start, text: 'Запрос не подтвердили до начала занятия', tone: 'bad' });
  if (status === 'completed') items.push({ at: b.end, text: 'Занятие проведено', tone: 'done' });
  if (b.report) items.push({ at: b.report.createdAt, text: 'Специалист добавил отчёт', tone: 'done' });
  if (status === 'pending') items.push({ at: null, text: viewer === 'parent' ? 'Ждём ответа специалиста' : 'Ждёт вашего ответа', tone: 'wait' });
  if (status === 'confirmed') items.push({ at: b.start, text: 'Занятие', tone: 'wait' });
  return (
    <ol className="timeline">
      {items.map((it, i) => (
        <motion.li
          key={`${it.text}-${i}`}
          className={`timeline__item timeline__item--${it.tone}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <span className="timeline__dot" />
          <span className="timeline__text">{it.text}</span>
          {it.at && <time>{fmtDayTime(it.at, now)}</time>}
        </motion.li>
      ))}
    </ol>
  );
}

function ReportView({ report }) {
  return (
    <section className="card-section report">
      <h2>
        <ClipboardTextIcon size={22} weight="fill" /> Отчёт о занятии
      </h2>
      <dl>
        <dt>Что делали</dt>
        <dd>{report.summary}</dd>
        {report.progress && (
          <>
            <dt>Успехи</dt>
            <dd>{report.progress}</dd>
          </>
        )}
        {report.homework && (
          <>
            <dt>Рекомендации и задания</dt>
            <dd>{report.homework}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function ReportForm({ booking, userId }) {
  const toast = useToast();
  const [form, setForm] = useState({ summary: '', progress: '', homework: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    try {
      await addSessionReport(userId, booking.id, form);
      toast.success('Отчёт отправлен родителю');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card-section report-form">
      <h2>
        <ClipboardTextIcon size={22} weight="fill" /> Отчёт о занятии
      </h2>
      <p className="muted">Коротко расскажите родителю, как прошло занятие — это помогает видеть прогресс.</p>
      <Field label="Что делали">
        <Textarea rows={3} maxLength={800} value={form.summary} onChange={set('summary')} placeholder="Игры, упражнения, темы" />
      </Field>
      <Field label="Успехи" optional>
        <Textarea rows={2} maxLength={600} value={form.progress} onChange={set('progress')} placeholder="Что получилось лучше, чем в прошлый раз" />
      </Field>
      <Field label="Рекомендации и задания" optional>
        <Textarea rows={2} maxLength={600} value={form.homework} onChange={set('homework')} placeholder="Что повторить дома до следующей встречи" />
      </Field>
      <Button variant="dark" onClick={submit} loading={busy} disabled={form.summary.trim().length < 10}>
        Отправить отчёт
      </Button>
    </section>
  );
}

function ReviewForm({ booking, userId }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await addReview(userId, booking.id, { rating, text });
      toast.success('Спасибо за отзыв!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card-section review-form">
      <h2>
        <StarIcon size={22} weight="fill" /> Как прошло занятие?
      </h2>
      <p className="muted">Ваш отзыв увидят другие родители — он поможет им выбрать специалиста.</p>
      <StarInput value={rating} onChange={setRating} />
      <Field label="Комментарий" optional>
        <Textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Что понравилось, что изменилось у ребёнка" />
      </Field>
      <Button variant="dark" onClick={submit} loading={busy} disabled={!rating}>
        Оставить отзыв
      </Button>
    </section>
  );
}

export default function BookingDetail({ viewer }) {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow(15_000);
  const b = useBooking(id);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = viewer === 'parent' ? '/parent' : '/specialist';
  const listPath = viewer === 'parent' ? '/parent/bookings' : '/specialist/requests';

  if (b === undefined) return <div className="page page--loading" />;
  const mine = b && (viewer === 'parent' ? b.parentId : b.specialistId) === user.id;
  if (!b || !mine) {
    return (
      <div className="page">
        <PageHeader back={listPath} title="Запись" />
        <EmptyState icon={CalendarXIcon} title="Запись не найдена" text="Возможно, её удалили." action={<ButtonLink to={listPath}>К списку</ButtonLink>} />
      </div>
    );
  }

  const status = displayStatus(b, now);
  const future = b.start > now;
  const child = b.child;
  const convPath = `${base}/messages/${conversationIdFor(b.parentId, b.specialistId)}`;

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      if (okText) toast.success(okText);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const canCancel =
    future && (viewer === 'parent' ? ['pending', 'confirmed'].includes(b.status) : b.status === 'confirmed');
  const canRespond = viewer === 'specialist' && status === 'pending';

  return (
    <div className="page booking">
      <PageHeader
        back={listPath}
        title={viewer === 'parent' ? 'Запись на занятие' : 'Запрос на занятие'}
      />

      <div className="booking__layout">
        <div className="booking__main">
          <motion.section className="when-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="when-card__date">
              <span>{fmtWeekday(b.start)}</span>
              <strong>{new Date(b.start).getDate()}</strong>
              <span>{fmtShortDate(b.start).split(' ')[1]}</span>
            </div>
            <div className="when-card__info">
              <StatusBadge status={status} />
              <strong>{fmtDay(b.start, now)}</strong>
              <span>
                {fmtRange(b.start, b.end)} · {b.duration} мин
              </span>
              <span>
                {b.format === 'online' ? (
                  <>
                    <VideoCameraIcon size={15} weight="bold" /> Онлайн, видеокомната Pingo
                  </>
                ) : (
                  <>
                    <MapPinIcon size={15} weight="bold" /> Очно — адрес согласуйте в чате
                  </>
                )}
              </span>
            </div>
          </motion.section>

          {b.format === 'online' && <RoomBlock booking={b} now={now} />}

          {viewer === 'parent' ? (
            <section className="card-section person-card">
              <Avatar avatar={b.specialist?.avatar} name={b.specialist?.name} size={56} />
              <div>
                <strong>{b.specialist?.name}</strong>
                <span>Ребёнок: {child?.name ?? '—'}</span>
              </div>
              <Link to={`/parent/specialists/${b.specialistId}`} className="link-arrow">
                Анкета <ArrowRightIcon size={16} />
              </Link>
            </section>
          ) : (
            <section className="card-section child-info">
              <div className="person-card">
                <Avatar avatar={child?.avatar} name={child?.name} size={56} />
                <div>
                  <strong>
                    {child?.name}, {fmtAge(ageFromBirthDate(child?.birthDate))}
                  </strong>
                  <span>Родитель: {b.parent?.name}</span>
                </div>
              </div>
              {child?.needs?.length > 0 && (
                <div className="tags">
                  {child.needs.map((n) => (
                    <span key={n} className="tag">
                      {n === 'other' ? child.needsOther || 'Другое' : NEED_MAP[n]?.label}
                    </span>
                  ))}
                </div>
              )}
              <dl className="info-list">
                {child?.learningStyles?.length > 0 && (
                  <>
                    <dt>Как учится</dt>
                    <dd>{child.learningStyles.map((s) => LEARNING_STYLE_MAP[s]?.label).join(', ')}</dd>
                  </>
                )}
                {describeAccessibility(child?.accessibility).length > 0 && (
                  <>
                    <dt>Комфортный интерфейс</dt>
                    <dd>{describeAccessibility(child.accessibility).join(', ')}</dd>
                  </>
                )}
                {child?.goals && (
                  <>
                    <dt>Цели</dt>
                    <dd>{child.goals}</dd>
                  </>
                )}
                {child?.notes && (
                  <>
                    <dt>Важно знать</dt>
                    <dd>{child.notes}</dd>
                  </>
                )}
              </dl>
            </section>
          )}

          {b.note && (
            <section className="card-section">
              <h2>Заметка родителя</h2>
              <p className="prewrap">{b.note}</p>
            </section>
          )}

          {status === 'completed' &&
            (b.report ? (
              <ReportView report={b.report} />
            ) : viewer === 'specialist' ? (
              <ReportForm booking={b} userId={user.id} />
            ) : (
              <section className="card-section">
                <h2>Отчёт о занятии</h2>
                <p className="muted">Специалист ещё не добавил отчёт — мы пришлём уведомление.</p>
              </section>
            ))}

          {status === 'completed' && b.review && (
            <section className="card-section">
              <h2>Отзыв родителя</h2>
              <Stars value={b.review.rating} size={20} />
              {b.review.text && <p className="review-text">{b.review.text}</p>}
            </section>
          )}
          {status === 'completed' && viewer === 'parent' && !b.reviewId && (
            <ReviewForm booking={b} userId={user.id} />
          )}

          <section className="card-section">
            <h2>История</h2>
            <Timeline b={b} now={now} viewer={viewer} />
          </section>
        </div>

        <aside className="booking__side">
          <div className={cx('action-box', canRespond && 'action-box--attention')}>
            {canRespond && (
              <>
                <p className="action-box__title">Ответьте на запрос</p>
                <Button variant="primary" size="lg" icon={CheckIcon} block loading={busy} onClick={() => run(() => confirmBooking(user.id, b.id), 'Занятие подтверждено')}>
                  Принять
                </Button>
                <Button variant="soft" size="lg" icon={XIcon} block onClick={() => setDialog('decline')}>
                  Отклонить
                </Button>
              </>
            )}
            <ButtonLink to={convPath} variant={canRespond ? 'ghost' : 'soft'} size="lg" icon={ChatCircleDotsIcon} block>
              Написать {viewer === 'parent' ? 'специалисту' : 'родителю'}
            </ButtonLink>
            {canCancel && (
              <Button variant="danger-ghost" block onClick={() => setDialog('cancel')}>
                {b.status === 'pending' ? 'Отменить запрос' : 'Отменить занятие'}
              </Button>
            )}
          </div>
        </aside>
      </div>

      <ReasonDialog
        open={dialog === 'decline'}
        onClose={() => setDialog(null)}
        title="Отклонить запрос"
        text="Родитель увидит причину и сможет выбрать другое время или специалиста."
        templates={DECLINE_TEMPLATES}
        placeholder="Например: в это время у меня другое занятие"
        confirmLabel="Отклонить"
        onConfirm={(reason) => declineBooking(user.id, b.id, reason).then(() => toast.info('Запрос отклонён'))}
      />
      <ReasonDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title={b.status === 'pending' ? 'Отменить запрос?' : 'Отменить занятие?'}
        text={`${viewer === 'parent' ? 'Специалист' : 'Родитель'} получит уведомление. Время освободится для других.`}
        templates={viewer === 'parent' ? CANCEL_TEMPLATES : ['Заболел(а).', 'Непредвиденные обстоятельства.']}
        confirmLabel="Отменить запись"
        onConfirm={(reason) => cancelBooking(user.id, b.id, reason).then(() => toast.info('Запись отменена'))}
      />
    </div>
  );
}
