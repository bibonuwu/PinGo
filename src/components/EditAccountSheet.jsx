import { useEffect, useState } from 'react';
import { UserIcon } from '@phosphor-icons/react';
import { useToast } from '../context/ToastContext';
import { updateAccount } from '../services/auth';
import { cx } from '../lib/utils';
import { Avatar, AvatarPicker } from './Avatar';
import { Sheet } from './Sheet';
import { Button, Field, Input } from './ui';
import { t } from '../i18n';

export function EditAccountSheet({ user, open, onClose }) {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setAvatar(user.avatar);
    }
  }, [open, user.name, user.avatar]);

  const save = async () => {
    setBusy(true);
    try {
      await updateAccount(user.id, { name, avatar });
      toast.success(t('Профиль обновлён'));
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Редактировать профиль')}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            {t('Отмена')}
          </Button>
          <Button variant="dark" onClick={save} loading={busy}>
            {t('Сохранить')}
          </Button>
        </>
      }
    >
      <Field label={t('Имя')} htmlFor="acc-name">
        <Input id="acc-name" icon={UserIcon} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('Аватар')}>
        <div className="avatar-none">
          <button type="button" className={cx('avatar-none__btn', !avatar && 'is-active')} onClick={() => setAvatar(null)}>
            <Avatar name={name} size={56} />
            <span>{t('Инициалы')}</span>
          </button>
        </div>
        <AvatarPicker value={avatar} onChange={setAvatar} size={60} />
      </Field>
      <p className="muted small">Email: {user.email}</p>
    </Sheet>
  );
}
