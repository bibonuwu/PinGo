// Сессия хранится и в sessionStorage (своя для каждой вкладки), и в localStorage
// (чтобы новая вкладка открылась под последним пользователем). Так можно открыть
// родителя и специалиста в соседних вкладках и проверить запись, чат и видеозвонок.
const KEY = 'pingo.session';

export function getSession() {
  try {
    return sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSession(userId) {
  try {
    sessionStorage.setItem(KEY, userId);
    localStorage.setItem(KEY, userId);
  } catch {
    /* хранилище недоступно — сессия живёт до перезагрузки */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
