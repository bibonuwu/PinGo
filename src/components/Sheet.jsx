import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from '@phosphor-icons/react';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useToast } from '../context/ToastContext';
import { cx } from '../lib/utils';
import { Button, Chip, Field, Textarea } from './ui';

let openSheets = 0;

// Модальное окно: на телефоне — шторка снизу, на компьютере — диалог по центру.
export function Sheet({ open, onClose, title, children, footer, size = 'md', className }) {
  const desktop = useIsDesktop();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    openSheets += 1;
    document.body.classList.add('no-scroll');
    const prevFocus = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector('[data-autofocus], input, textarea, select, button:not(.sheet__close)');
      el?.focus({ preventScroll: true });
    }, 60);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      openSheets -= 1;
      if (openSheets <= 0) document.body.classList.remove('no-scroll');
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const motionProps = desktop
    ? {
        initial: { opacity: 0, scale: 0.96, y: 16 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97, y: 8 },
      }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root">
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cx('sheet', `sheet--${size}`, className)}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            {...motionProps}
          >
            <div className="sheet__handle" aria-hidden="true" />
            {title && (
              <div className="sheet__header">
                <h2 className="sheet__title">{title}</h2>
                <button type="button" className="icon-btn icon-btn--soft icon-btn--sm sheet__close" aria-label="Закрыть" onClick={onClose}>
                  <XIcon size={18} weight="bold" />
                </button>
              </div>
            )}
            <div className="sheet__body">{children}</div>
            {footer && <div className="sheet__footer">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function useAsyncAction(onDone) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onDone?.();
    } catch (e) {
      toast.error(e.message || 'Что-то пошло не так');
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

export function ConfirmDialog({ open, onClose, title, text, confirmLabel = 'Подтвердить', tone = 'dark', onConfirm }) {
  const [busy, run] = useAsyncAction(onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Назад
          </Button>
          <Button variant={tone} loading={busy} onClick={() => run(onConfirm)} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && <p className="muted">{text}</p>}
    </Sheet>
  );
}

// Диалог с причиной: отказ модератора (обязательно), отклонение или отмена записи (по желанию).
export function ReasonDialog({
  open,
  onClose,
  title,
  text,
  required = false,
  minLength = 10,
  templates = [],
  placeholder = 'Причина',
  confirmLabel = 'Отправить',
  tone = 'danger',
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, run] = useAsyncAction(() => {
    setReason('');
    onClose();
  });

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const submit = () => {
    const r = reason.trim();
    if (required && r.length < minLength) {
      setError(`Укажите причину — минимум ${minLength} символов`);
      return;
    }
    run(() => onConfirm(r));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Назад
          </Button>
          <Button variant={tone} loading={busy} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && <p className="muted">{text}</p>}
      {templates.length > 0 && (
        <div className="chips chips--wrap">
          {templates.map((t) => (
            <Chip key={t} active={reason === t} onClick={() => setReason(t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}
      <Field
        label={required ? 'Причина (обязательно)' : 'Причина'}
        optional={!required}
        error={error}
        counter={`${reason.length}/500`}
      >
        <Textarea
          value={reason}
          maxLength={500}
          placeholder={placeholder}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
          rows={3}
        />
      </Field>
    </Sheet>
  );
}
