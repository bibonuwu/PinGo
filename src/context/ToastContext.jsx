import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import { uid } from '../lib/utils';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircleIcon, error: WarningCircleIcon, info: InfoIcon };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { tone = 'info', title, action, duration = 4000 } = {}) => {
      const id = uid();
      setToasts((list) => [...list.slice(-2), { id, message, tone, title, action }]);
      if (duration !== Infinity) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (m, o) => show(m, { ...o, tone: 'success' }),
      error: (m, o) => show(m, { ...o, tone: 'error' }),
      info: (m, o) => show(m, { ...o, tone: 'info' }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toaster" role="region" aria-label="Уведомления" aria-live="polite">
          <AnimatePresence initial={false}>
            {toasts.map((t) => {
              const Icon = ICONS[t.tone] ?? InfoIcon;
              return (
                <motion.div
                  key={t.id}
                  layout
                  className={`toast toast--${t.tone}`}
                  initial={{ opacity: 0, y: -16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                >
                  <Icon size={22} weight="fill" className="toast__icon" />
                  <div className="toast__body">
                    {t.title && <strong>{t.title}</strong>}
                    <span>{t.message}</span>
                  </div>
                  {t.action && (
                    <button
                      type="button"
                      className="toast__action"
                      onClick={() => {
                        t.action.onClick();
                        dismiss(t.id);
                      }}
                    >
                      {t.action.label}
                    </button>
                  )}
                  <button type="button" className="toast__close" aria-label="Закрыть" onClick={() => dismiss(t.id)}>
                    <XIcon size={16} weight="bold" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
