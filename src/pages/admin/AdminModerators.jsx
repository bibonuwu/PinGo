import { useState } from 'react';
import { EnvelopeSimpleIcon, TrashIcon, UserPlusIcon } from '@phosphor-icons/react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { db } from '../../lib/db';
import { ADMIN_EMAILS, normEmail } from '../../lib/constants';
import { fmtDateYear, isEmail } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { addModerator, removeModerator } from '../../services/admin';
import { Avatar } from '../../components/Avatar';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/Sheet';
import { Button, Field, IconButton, Input, SectionLabel } from '../../components/ui';
import { t } from '../../i18n';

// Команда модераторов: основатели (ADMIN_EMAILS) и те, кого добавили модераторы (коллекция moderators).
export default function AdminModerators() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  // Почта в диалоге остаётся и после закрытия — заголовок не мигает, пока диалог исчезает.
  const [adding, setAdding] = useState({ open: false, email: '' });
  const [removing, setRemoving] = useState({ open: false, email: '' });

  const team = useLiveQuery(async () => {
    const [added, users] = await Promise.all([db.moderators.toArray(), db.users.toArray()]);
    const byEmail = new Map(users.filter((u) => u.email).map((u) => [u.email, u]));
    const row = (m, founder) => ({ ...m, founder, account: byEmail.get(m.email) ?? null });
    return [
      ...ADMIN_EMAILS.map((e) => row({ email: e }, true)),
      ...added.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).map((m) => row(m, false)),
    ];
  }, []);

  if (!team) return <div className="page page--loading" />;

  const myEmail = normEmail(me.email);

  const ask = (e) => {
    e.preventDefault();
    const value = normEmail(email);
    if (!isEmail(value)) return setError(t('Проверьте адрес электронной почты'));
    if (team.some((m) => m.email === value)) return setError(t('{email} уже в команде модераторов', { email: value }));
    setError('');
    setAdding({ open: true, email: value });
  };

  return (
    <div className="page">
      <PageHeader back="/admin/users" title={t('Модераторы')} subtitle={t('Команда Pingo, которая проверяет анкеты и разбирает жалобы.')} />

      <section className="card-section">
        <h2>{t('Добавить модератора')}</h2>
        <form className="moderator-form" onSubmit={ask} noValidate>
          <Field label={t('Почта')} htmlFor="mod-email" error={error}>
            <Input
              id="mod-email"
              type="email"
              icon={EnvelopeSimpleIcon}
              autoComplete="off"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
            />
          </Field>
          <Button type="submit" variant="primary" icon={UserPlusIcon}>
            {t('Добавить')}
          </Button>
        </form>
        <p className="muted small">
          {t('Доступ к админ-панели откроется, когда человек войдёт в Pingo с этой почтой — через Google или подтвердив адрес из письма.')}
        </p>
      </section>

      <SectionLabel>{t('Команда · {count}', { count: team.length })}</SectionLabel>
      <ul className="admin-list">
        {team.map((m) => {
          const active = m.account?.role === 'admin';
          const self = m.email === myEmail;
          return (
            <li key={m.email} className="admin-row admin-row--static">
              <Avatar avatar={m.account?.avatar} name={m.account?.name || m.email} size={48} />
              <span className="admin-row__body">
                <span className="admin-row__top">
                  <strong>{m.account?.name ?? m.email}</strong>
                  {m.founder && <span className="tag tag--yellow">{t('основатель')}</span>}
                  {!active && <span className="tag tag--blue">{t('ждёт входа')}</span>}
                  {self && <span className="muted small">{t('это вы')}</span>}
                </span>
                {m.account && <span className="admin-row__title">{m.email}</span>}
                <span className="admin-row__meta">
                  {m.founder
                    ? t('Основатель Pingo')
                    : t('Добавил(а) {name} · {date}', { name: m.addedByName || t('модератор'), date: fmtDateYear(m.createdAt) })}
                </span>
              </span>
              {!m.founder && !self && (
                <IconButton icon={TrashIcon} label={t('Убрать из модераторов: {email}', { email: m.email })} size="sm" onClick={() => setRemoving({ open: true, email: m.email })} />
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={adding.open}
        onClose={() => setAdding((d) => ({ ...d, open: false }))}
        title={t('Сделать {email} модератором?', { email: adding.email })}
        text={t('Модератор видит данные всех пользователей и детей, публикует анкеты, разбирает жалобы и может добавлять других модераторов. Если у человека уже есть аккаунт родителя или специалиста, он станет аккаунтом модератора.')}
        confirmLabel={t('Добавить')}
        tone="primary"
        onConfirm={async () => {
          await addModerator(me, adding.email);
          toast.success(t('{email} добавлен(а) в команду модераторов', { email: adding.email }));
          setEmail('');
        }}
      />
      <ConfirmDialog
        open={removing.open}
        onClose={() => setRemoving((d) => ({ ...d, open: false }))}
        title={t('Убрать {email} из модераторов?', { email: removing.email })}
        text={t('Доступ к админ-панели закроется сразу. Аккаунт останется: если у человека есть анкета специалиста, он снова станет специалистом, иначе — родителем.')}
        confirmLabel={t('Убрать')}
        tone="danger"
        onConfirm={async () => {
          await removeModerator(me, removing.email);
          toast.success(t('{email} больше не модератор', { email: removing.email }));
        }}
      />
    </div>
  );
}
