import { useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { subscribe } from '../lib/db';

function isPlain(v) {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null || Array.isArray(v);
}

// Структурное сравнение результатов: если данные не изменились, компонент не перерисовывается.
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (!isPlain(a) || !isPlain(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => same(a[k], b[k]));
}

// «Живой» запрос к локальному зеркалу (как useLiveQuery из Dexie): выполняется сразу и повторяется
// при каждом изменении данных. Пока первого результата нет — undefined; при смене deps остаётся
// прежнее значение, пока не готово новое.
// Зеркало лежит в памяти, и первый результат готов через пару микрозадач. Запрос стартует в
// useLayoutEffect, а первый результат применяется синхронно (flushSync) — всё это успевает до отрисовки
// кадра, поэтому открытая страница сразу показывается с данными, без промежуточного кадра со спиннером.
export function useLiveQuery(querier, deps = []) {
  const [value, setValue] = useState();

  useLayoutEffect(() => {
    let active = true;
    let running = false;
    let again = false;
    let first = true;
    const run = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          const next = await querier();
          if (!active) return;
          const apply = () => setValue((prev) => (same(prev, next) ? prev : next));
          if (first) {
            first = false;
            flushSync(apply);
          } else {
            apply();
          }
        } while (again && active);
      } catch (e) {
        console.error(e);
      } finally {
        running = false;
      }
    };
    run();
    const off = subscribe(run);
    return () => {
      active = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
