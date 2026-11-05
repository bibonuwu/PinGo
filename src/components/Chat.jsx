import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { AnimatePresence, motion } from 'framer-motion';
import { FlagIcon, PaperPlaneRightIcon, CalendarDotsIcon, UserIcon } from '@phosphor-icons/react';
import { db } from '../lib/db';
import { COMPLAINT_REASONS } from '../lib/constants';
import { cx, fmtAgo, fmtDay, fmtTime, toDateKey } from '../lib/utils';
import { MAX_MESSAGE_LENGTH, markConversationRead, sendMessage, supportAdminOf } from '../services/chat';
import { createComplaint } from '../services/complaints';
import { useToast } from '../context/ToastContext';
import { Avatar } from './Avatar';
import { BackButton } from './PageHeader';
import { Sheet } from './Sheet';
import { Button, Chip, Field, IconButton, Textarea } from './ui';
import { t } from '../i18n';
import { storedText } from '../i18n/stored';

export function ConversationList({ items, me, basePath, activeId }) {
  return (
    <ul className="conv-list">
        {items.map((c, i) => {
          const unread = c.unread?.[me] || 0;
          const mine = c.lastSenderId === me;
          const admin = supportAdminOf(c);
          return (
            <motion.li
              key={c.id}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
            >
              <Link to={`${basePath}/${c.id}`} className={cx('conv', activeId === c.id && 'is-active', unread > 0 && 'is-unread')}>
                <Avatar avatar={c.other?.avatar} name={c.other?.name} size={52} />
                <span className="conv__body">
                  <span className="conv__top">
                    <span className="conv__name">
                      <strong>{c.other?.name ?? t('Пользователь')}</strong>
                      {admin && admin !== me && <span className="tag tag--yellow tag--xs">{t('модератор')}</span>}
                    </span>
                    <time>{fmtAgo(c.updatedAt)}</time>
                  </span>
                  <span className="conv__bottom">
                    <span className="conv__last">
                      {mine && t('Вы: ')}
                      {(c.lastKind === 'system' ? storedText(c.lastText, c.lastI18n) : c.lastText) || t('Нет сообщений')}
                    </span>
                    {unread > 0 && <span className="conv__badge">{unread}</span>}
                  </span>
                </span>
              </Link>
            </motion.li>
          );
        })}
    </ul>
  );
}

function groupByDay(messages) {
  const groups = [];
  for (const m of messages) {
    const key = toDateKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(m);
    else groups.push({ key, at: m.createdAt, items: [m] });
  }
  return groups;
}

export function ComplaintDialog({ open, onClose, reporterId, target, context }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await createComplaint({ reporterId, targetId: target.id, reason, details, context });
      toast.success(t('Жалоба отправлена. Модератор проверит её в ближайшее время.'));
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
      title={t('Пожаловаться')}
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            {t('Отмена')}
          </Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason}>
            {t('Отправить жалобу')}
          </Button>
        </>
      }
    >
      <p className="muted">
        {t('Жалобу получит модератор Pingo. Пользователь:')}{' '}<strong>{target?.name}</strong>{t('. Если ребёнку угрожает опасность — звоните 112.')}
      </p>
      <div className="chips chips--wrap">
        {COMPLAINT_REASONS.map((r) => (
          <Chip key={r.id} active={reason === r.id} onClick={() => setReason(r.id)}>
            {r.label}
          </Chip>
        ))}
      </div>
      <Field label={t('Подробности')} optional={reason !== 'other'}>
        <Textarea value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} placeholder={t('Что произошло?')} rows={3} />
      </Field>
    </Sheet>
  );
}

const ROLE_LABEL = { specialist: t('Специалист Pingo'), admin: t('Модератор Pingo'), parent: t('Родитель') };

// Лента сообщений + поле ввода. Используется в «Сообщениях» и в видеокомнате.
// conversation.draft — диалога ещё нет в базе, он создастся с первым сообщением.
export function ChatThread({ conversation, me, other, profileLink, bookingsLink, showHeader = true, backTo, className }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const id = conversation.id;

  const messages = useLiveQuery(
    async () => (await db.messages.where('conversationId').equals(id).toArray()).sort((a, b) => a.createdAt - b.createdAt),
    [id],
  );
  const groups = useMemo(() => groupByDay(messages ?? []), [messages]);
  const unread = conversation.unread?.[me] || 0;
  const admin = supportAdminOf(conversation);
  const support = Boolean(admin);
  // Пока карточка собеседника не загрузилась, роль понятна из устройства диалога.
  const otherRole =
    other?.role ?? (admin && admin !== me ? 'admin' : conversation.specialistId === me ? 'parent' : 'specialist');

  useEffect(() => {
    if (unread > 0) markConversationRead(id, me);
  }, [id, me, unread, messages?.length]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, id]);

  const autoGrow = (el) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await sendMessage(id, me, value, { draft: conversation.draft ? conversation : null });
      setText('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.focus();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={cx('chat', className)}>
      {showHeader && (
        <header className="chat__header">
          {backTo && <BackButton to={backTo} className="chat__back" />}
          <Avatar avatar={other?.avatar} name={other?.name} size={44} />
          <div className="chat__who">
            <strong>{other?.name ?? t('Пользователь')}</strong>
            <span>{ROLE_LABEL[otherRole]}</span>
          </div>
          <div className="chat__actions">
            {bookingsLink && <IconButton icon={CalendarDotsIcon} label={t('Записи')} to={bookingsLink} size="sm" />}
            {profileLink && <IconButton icon={UserIcon} label={t('Анкета')} to={profileLink} size="sm" />}
            {!support && <IconButton icon={FlagIcon} label={t('Пожаловаться')} size="sm" onClick={() => setComplaintOpen(true)} />}
          </div>
        </header>
      )}
      <div className="chat__list" ref={listRef}>
        {messages && messages.length === 0 && (
          <div className="chat__empty">
            <p>
              {support
                ? t('Напишите первое сообщение — собеседник увидит его в разделе «Сообщения» и получит уведомление.')
                : t('Напишите первое сообщение — например, расскажите о целях занятий.')}
            </p>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key} className="chat__day">
            <div className="chat__date">
              <span>{fmtDay(g.at)}</span>
            </div>
            <AnimatePresence initial={false}>
              {g.items.map((m) =>
                m.kind === 'system' ? (
                  <motion.div key={m.id} className="msg-system" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <span>{storedText(m.text, m.i18n)}</span>
                    <time>{fmtTime(m.createdAt)}</time>
                  </motion.div>
                ) : (
                  <motion.div
                    key={m.id}
                    className={cx('msg', m.senderId === me ? 'msg--mine' : 'msg--theirs')}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  >
                    <p>{m.text}</p>
                    <time>{fmtTime(m.createdAt)}</time>
                  </motion.div>
                ),
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <form
        className="chat__composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={t('Сообщение…')}
          aria-label={t('Сообщение')}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <motion.button
          type="submit"
          className="chat__send"
          aria-label={t('Отправить')}
          disabled={!text.trim() || sending}
          whileTap={{ scale: 0.88 }}
        >
          <PaperPlaneRightIcon size={22} weight="fill" />
        </motion.button>
      </form>
      {other && !support && (
        <ComplaintDialog
          open={complaintOpen}
          onClose={() => setComplaintOpen(false)}
          reporterId={me}
          target={other}
          context={{ conversationId: id }}
        />
      )}
    </section>
  );
}
