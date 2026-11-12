import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../lib/db';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { getSyncState, onSyncState } from '../services/sync';
import { logout } from '../services/auth';

const AuthContext = createContext(null);

export const homePath = (role) =>
  role === 'parent' ? '/parent' : role === 'specialist' ? '/specialist' : role === 'admin' ? '/admin' : '/';

// Первый шаг после регистрации: профиль ребёнка или анкета специалиста.
export const onboardingPath = (role) =>
  role === 'parent' ? '/parent/onboarding' : role === 'specialist' ? '/specialist/profile/edit?welcome=1' : homePath(role);

export function AuthProvider({ children }) {
  const [sync, setSync] = useState(getSyncState);
  const [booted, setBooted] = useState(false);
  // Выход (или удаление аккаунта) уже начался: кабинет скрываем сразу, не дожидаясь Firebase.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const off = onSyncState(setSync);
    // Состояние могло измениться до подписки (Firebase отвечает быстрее первого рендера).
    setSync(getSyncState());
    return off;
  }, []);
  useEffect(() => {
    if (sync.status === 'signedOut') setLeaving(false);
  }, [sync.status]);

  // Запись пользователя «живая»: изменения (в том числе с другого устройства) сразу видны.
  const me = useLiveQuery(async () => (sync.uid ? ((await db.users.get(sync.uid)) ?? null) : null), [sync.uid]);
  const ready = sync.status === 'ready' && me?.id === sync.uid;
  const loading = sync.status === 'loading' || (sync.status === 'ready' && !ready);

  useEffect(() => {
    if (!loading) setBooted(true);
  }, [loading]);

  const signOut = useCallback(async () => {
    setLeaving(true);
    try {
      await logout();
    } catch (e) {
      setLeaving(false);
      throw e;
    }
  }, []);

  const value = useMemo(
    () => ({
      user: ready && !leaving ? me : null,
      account: sync.account,
      // Подтверждена ли почта аккаунта (account меняется на месте, поэтому отдельное поле).
      accountVerified: sync.verified,
      // Почта аккаунта — почта модератора (основатель или добавлен другим модератором).
      moderator: sync.moderator,
      loading,
      // Первая загрузка приложения: ещё неизвестно, вошёл ли пользователь.
      initializing: !booted && loading,
      // Вошли (например, через Google), но роль ещё не выбрана.
      needsProfile: sync.status === 'needsProfile' && !leaving,
      leaving,
      setLeaving,
      signOut,
    }),
    [ready, leaving, me, sync.account, sync.verified, sync.moderator, sync.status, loading, booted, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
