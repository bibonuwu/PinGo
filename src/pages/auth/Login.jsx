import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EnvelopeSimpleIcon, EyeIcon, EyeSlashIcon, GoogleLogoIcon, LockIcon } from '@phosphor-icons/react';
import { useToast } from '../../context/ToastContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { loginUser, loginWithGoogle, resetPassword } from '../../services/auth';
import { BackButton } from '../../components/PageHeader';
import { Button, Input } from '../../components/ui';

// После входа на нужную страницу (кабинет или ссылку, с которой пришли) переводит PublicOnly.
export default function Login() {
  useThemeColor('#141414');
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const run = (kind, action) => async (e) => {
    e?.preventDefault();
    setBusy(kind);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const submit = run('form', () => loginUser(email, password));
  const google = run('google', loginWithGoogle);

  const forgot = async () => {
    setError('');
    try {
      await resetPassword(email);
      toast.success(`Ссылка для нового пароля отправлена на ${email.trim()}. Проверьте почту и папку «Спам».`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth auth--dark">
      <motion.img
        src="/images/deco-shapes.png"
        alt=""
        className="auth__deco auth__deco--tl"
        initial={{ x: -60, y: -40, opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 16 }}
      />
      <motion.img
        src="/images/deco-star.png"
        alt=""
        className="auth__deco auth__deco--star"
        initial={{ x: 80, opacity: 0, rotate: 30 }}
        animate={{ x: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.15 }}
      />
      <div className="auth__top">
        <BackButton to="/" variant="dark" />
      </div>

      <motion.div
        className="auth__panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      >
        <h1 className="auth__title">С возвращением!</h1>
        <p className="auth__subtitle">Войдите, чтобы продолжить заботу о ребёнке.</p>

        <form className="auth__form" onSubmit={submit} noValidate>
          <Input
            dark
            icon={EnvelopeSimpleIcon}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            dark
            icon={LockIcon}
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Пароль"
            aria-label="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            trailing={
              <button
                type="button"
                className="input__eye"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {show ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            }
          />
          <AnimatePresence>
            {error && (
              <motion.p
                className="auth__error"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -4, 4, 0] }}
                exit={{ opacity: 0, height: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Button type="submit" variant="light" size="lg" block loading={busy === 'form'} disabled={!email || !password || !!busy}>
            Войти
          </Button>
        </form>

        <button type="button" className="auth__forgot" onClick={forgot} disabled={!!busy}>
          Забыли пароль?
        </button>

        <div className="auth__divider">
          <span>или</span>
        </div>

        <Button
          variant="outline-yellow"
          size="lg"
          block
          icon={GoogleLogoIcon}
          loading={busy === 'google'}
          disabled={!!busy && busy !== 'google'}
          onClick={google}
        >
          Войти через Google
        </Button>

        <p className="auth__switch">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </motion.div>

      <motion.img
        src="/images/login-penguin.png"
        alt=""
        className="auth__penguin"
        initial={{ y: 120 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 110, damping: 18, delay: 0.2 }}
      />
    </div>
  );
}
