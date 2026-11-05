import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { PresenceContext, motion } from 'framer-motion';

// Чаты одного раздела не перемонтируются при переключении диалога (список слева остаётся на месте).
function routeKey(path) {
  const m = path.match(/^\/(parent|specialist|admin)\/messages/);
  return m ? m[0] : path;
}

// Сколько после открытия страницы её элементы появляются сразу, без анимации появления.
const SETTLE_MS = 300;

// Страница при переходе показывается сразу целиком: без затухания и без повторного «въезда» карточек —
// иначе каждый переход выглядит как перезагрузка. Это тот же механизм, что AnimatePresence initial={false}:
// framer-motion читает initial из контекста один раз, когда элемент появляется. Поэтому через SETTLE_MS
// значение можно просто поменять без перерисовки — то, что появится позже (новое сообщение, подсказка),
// анимируется как обычно.
function InstantPage({ children }) {
  const [presence] = useState(() => ({ id: 'page', isPresent: true, initial: false, register: () => () => {} }));
  useEffect(() => {
    const t = setTimeout(() => {
      presence.initial = undefined;
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [presence]);
  return (
    <PresenceContext.Provider value={presence}>
      <div className="page-motion">{children}</div>
    </PresenceContext.Provider>
  );
}

// Анимируется только первая страница после входа в кабинет. Анимацию ухода (AnimatePresence mode="wait")
// не используем: в framer-motion 11 она может «зависнуть», если на уходящей странице ещё идёт
// layout-анимация, и новая страница не появится.
// Suspense стоит снаружи страницы: переходы идут через startTransition (см. App.jsx), и пока код новой
// страницы загружается, на экране остаётся прежняя — вместо мигания спиннером.
export function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const key = routeKey(location.pathname);
  const firstKey = useRef(key);
  const instant = key !== firstKey.current;

  useLayoutEffect(() => {
    if (key !== firstKey.current) firstKey.current = null;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [key]);

  return (
    <Suspense fallback={<div className="page page--loading" />}>
      {instant ? (
        <InstantPage key={key}>{outlet}</InstantPage>
      ) : (
        <motion.div
          key={key}
          className="page-motion"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {outlet}
        </motion.div>
      )}
    </Suspense>
  );
}
