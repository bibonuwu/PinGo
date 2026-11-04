import { useEffect, useState } from 'react';

// Текущее время, которое обновляется с заданным шагом (для таймеров и статусов записей).
export function useNow(interval = 30_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
