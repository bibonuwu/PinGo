import { useEffect } from 'react';

// Цвет строки состояния в браузере и установленном приложении под текущий экран.
export function useThemeColor(color) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return undefined;
    const prev = meta.getAttribute('content');
    meta.setAttribute('content', color);
    return () => meta.setAttribute('content', prev);
  }, [color]);
}
