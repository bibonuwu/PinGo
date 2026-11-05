import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ArrowsClockwiseIcon, EnvelopeSimpleIcon, SignOutIcon } from '@phosphor-icons/react';
import { isAdminEmail } from '../lib/constants';
import { homePath, onboardingPath, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sendVerificationEmail } from '../services/auth';
import { recheckAccount } from '../services/sync';
import { Pingo } from '../components/Pingo';
import { Button } from '../components/ui';
import { t } from '../i18n';

const JUST_REGISTERED_MS = 10 * 60 * 1000;

export function FullScreenLoader() {
  return (
    <div className="fullscreen-loader" role="status" aria-label={t('Загрузка')}>
      <Pingo size={88} mood="happy" />
    </div>
  );
}

// Почта модератора, но адрес не подтверждён (регистрация по паролю): админ-панель — после подтверждения.
function VerifyAdminEmail({ email, onSignOut }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const run = (kind, fn) => async () => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };
  const check = run('check', async () => {
    if (!(await recheckAccount())) toast.info(t('Почта ещё не подтверждена — откройте ссылку из письма Pingo.'));
  });
  const send = run('send', async () => {
    await sendVerificationEmail();
    toast.success(t('Письмо отправлено на {email}. Проверьте и папку «Спам».', { email }));
  });
  return (
    <div className="gate">
      <Pingo size={96} mood="open" wave />
      <h1>{t('Подтвердите почту')}</h1>
      <p>
        {t('Админ-панель Pingo откроется для {email} после подтверждения адреса. Перейдите по ссылке из письма, затем нажмите «Я подтвердил(а) почту».', { email })}
      </p>
      <div className="btn-row">
        <Button variant="primary" icon={ArrowsClockwiseIcon} loading={busy === 'check'} onClick={check}>
          {t('Я подтвердил(а) почту')}
        </Button>
        <Button variant="soft" icon={EnvelopeSimpleIcon} loading={busy === 'send'} onClick={send}>
          {t('Отправить письмо ещё раз')}
        </Button>
      </div>
      <button type="button" className="link-btn" onClick={onSignOut}>
        {t('Выйти')}
      </button>
    </div>
  );
}

// Роль admin без почты модератора (например, выданная раньше вручную в консоли).
function NoAdminAccess({ onSignOut }) {
  return (
    <div className="gate">
      <Pingo size={96} mood="happy" />
      <h1>{t('Нет доступа')}</h1>
      <p>{t('Админ-панель Pingo доступна только модераторам команды. Если это ошибка — напишите в поддержку.')}</p>
      <Button variant="dark" icon={SignOutIcon} onClick={onSignOut}>
        {t('Выйти')}
      </Button>
    </div>
  );
}

export function RequireAuth({ role, children }) {
  const { user, account, accountVerified, loading, needsProfile, leaving, signOut } = useAuth();
  const location = useLocation();
  if (leaving) return <Navigate to="/" replace />;
  if (loading) return <FullScreenLoader />;
  if (needsProfile) return <Navigate to="/register" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (isAdminEmail(account?.email) && !accountVerified) return <VerifyAdminEmail email={account.email} onSignOut={signOut} />;
  if (user.role === 'admin' && !isAdminEmail(account?.email)) return <NoAdminAccess onSignOut={signOut} />;
  if (role && user.role !== role) return <Navigate to={homePath(user.role)} replace />;
  return children;
}

// Публичные страницы (приветствие, вход, регистрация) для вошедшего пользователя не нужны.
export function PublicOnly() {
  const { user, initializing, needsProfile } = useAuth();
  const location = useLocation();
  if (initializing) return <FullScreenLoader />;
  const registering = location.pathname.startsWith('/register');
  if (user) {
    // Только что зарегистрировались — сразу к первому шагу.
    if (registering && Date.now() - (user.createdAt ?? 0) < JUST_REGISTERED_MS) {
      return <Navigate to={onboardingPath(user.role)} replace />;
    }
    const from = location.state?.from;
    const home = homePath(user.role);
    return <Navigate to={from?.startsWith(home) || from?.startsWith('/room/') ? from : home} replace />;
  }
  // Вошли через Google, но ещё не выбрали роль — завершаем регистрацию.
  if (needsProfile && !registering) return <Navigate to="/register" replace state={location.state} />;
  return <Outlet />;
}
