import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EnvelopeSimpleIcon, EyeIcon, EyeSlashIcon, GoogleLogoIcon, LockIcon, UserIcon } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { MIN_PASSWORD, completeRegistration, registerUser, registerWithGoogle } from '../../services/auth';
import { BackButton } from '../../components/PageHeader';
import { PingoGuide } from '../../components/Pingo';
import { Button, Checkbox, Field, Input } from '../../components/ui';
import { t } from '../../i18n';

const COPY = {
  parent: {
    chip: t('Родитель'),
    bubble: t('Давайте познакомимся! После регистрации я помогу заполнить профиль ребёнка — это займёт пару минут.'),
    outfit: 'glasses',
  },
  specialist: {
    chip: t('Специалист / волонтёр'),
    bubble: t('Отлично, что вы с нами! После регистрации заполните анкету — модератор проверит её, и родители увидят вас в каталоге.'),
    outfit: 'scarf',
  },
};

const NEED_AGREEMENT = t('Нужно согласие с правилами платформы и обработкой данных');

// После регистрации к первому шагу (профиль ребёнка или анкета) переводит PublicOnly.
export default function Register() {
  useThemeColor('#FFFFFF');
  const { role } = useParams();
  const { account, needsProfile, signOut } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  // Вошли через Google, но аккаунт в Pingo ещё не создан: осталось подтвердить роль и имя.
  // Режим не переключается посреди отправки формы — только когда ничего не грузится.
  const [completing, setCompleting] = useState(() => needsProfile && !!account);

  useEffect(() => {
    if (!account) setCompleting(false);
    else if (needsProfile && !busy) setCompleting(true);
  }, [account, needsProfile, busy]);

  useEffect(() => {
    if (completing && account?.displayName) setForm((f) => (f.name ? f : { ...f, name: account.displayName }));
  }, [completing, account]);

  if (!COPY[role]) return <Navigate to="/register" replace />;
  const copy = COPY[role];
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!agree) {
      setError(NEED_AGREEMENT);
      return;
    }
    setBusy('form');
    setError('');
    try {
      if (completing) await completeRegistration({ role, name: form.name });
      else await registerUser({ role, ...form });
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const google = async () => {
    if (!agree) {
      setError(NEED_AGREEMENT);
      return;
    }
    setBusy('google');
    setError('');
    try {
      // null — имя из Google не подошло: форма переключится на «завершить регистрацию».
      if (!(await registerWithGoogle(role))) setBusy('');
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  return (
    <div className="register">
      <div className="register__top">
        <BackButton to="/register" />
        <Link to="/register" className="role-chip">
          {t('{chip} · сменить', { chip: copy.chip })}
        </Link>
      </div>
      <div className="register__body">
        <PingoGuide outfit={copy.outfit} mood="happy" wave bubbleKey={role}>
          {copy.bubble}
        </PingoGuide>
        <motion.h1 className="page-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {completing ? t('Почти готово') : t('Создать аккаунт')}
        </motion.h1>
        <form className="register__form" onSubmit={submit} noValidate>
          <Field label={t('Как вас зовут?')} htmlFor="reg-name">
            <Input
              id="reg-name"
              icon={UserIcon}
              autoComplete="name"
              placeholder={role === 'parent' ? t('Например, Дана Ахметова') : t('Имя и фамилия')}
              value={form.name}
              onChange={set('name')}
            />
          </Field>
          {!completing && (
            <>
              <Field label="Email" htmlFor="reg-email">
                <Input
                  id="reg-email"
                  icon={EnvelopeSimpleIcon}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                />
              </Field>
              <Field label={t('Пароль')} htmlFor="reg-pass" hint={t('Минимум {MIN_PASSWORD} символов', { MIN_PASSWORD })}>
                <Input
                  id="reg-pass"
                  icon={LockIcon}
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('Придумайте пароль')}
                  value={form.password}
                  onChange={set('password')}
                  trailing={
                    <button
                      type="button"
                      className="input__eye"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? t('Скрыть пароль') : t('Показать пароль')}
                    >
                      {show ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}
                    </button>
                  }
                />
              </Field>
            </>
          )}
          <Checkbox checked={agree} onChange={setAgree}>
            {t('Принимаю правила платформы и согласен(на) на обработку персональных данных')}
          </Checkbox>
          {error && (
            <motion.p className="form-error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, 0] }}>
              {error}
            </motion.p>
          )}
          <Button type="submit" variant="dark" size="lg" block loading={busy === 'form'} disabled={!!busy && busy !== 'form'}>
            {completing ? t('Продолжить') : t('Зарегистрироваться')}
          </Button>
          {!completing && (
            <Button
              variant="soft"
              size="lg"
              block
              icon={GoogleLogoIcon}
              loading={busy === 'google'}
              disabled={!!busy && busy !== 'google'}
              onClick={google}
            >
              {t('Продолжить с Google')}
            </Button>
          )}
        </form>
        {completing ? (
          <p className="register__note">
            {t('Вы вошли как {email}.', { email: account?.email })}{' '}
            <button type="button" className="link-btn" onClick={signOut}>
              {t('Войти другим аккаунтом')}
            </button>
          </p>
        ) : (
          <p className="register__footer">
            {t('Уже есть аккаунт?')}{' '}<Link to="/login">{t('Войти')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
