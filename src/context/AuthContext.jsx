import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { clearSession, getSession, setSession } from '../lib/session';

const AuthContext = createContext(null);

export const homePath = (role) =>
  role === 'parent' ? '/parent' : role === 'specialist' ? '/specialist' : role === 'admin' ? '/admin' : '/';

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(getSession);
  // Запись пользователя «живая»: любые изменения в БД (в том числе из соседней вкладки) сразу видны.
  const result = useLiveQuery(
    async () => ({ id: userId, user: userId ? ((await db.users.get(userId)) ?? null) : null }),
    [userId],
  );
  const loading = !result || result.id !== userId;
  const user = loading ? null : result.user;

  const signIn = useCallback((u) => {
    setSession(u.id);
    setUserId(u.id);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUserId(null);
  }, []);

  // Сессия ссылается на удалённого пользователя (например, после сброса данных).
  useEffect(() => {
    if (!loading && userId && !user) signOut();
  }, [loading, userId, user, signOut]);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
