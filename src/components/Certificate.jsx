import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CertificateIcon, TrashIcon } from '@phosphor-icons/react';
import { CERTIFICATE_MAP, CERTIFICATE_TYPES } from '../lib/constants';
import { fmtDateYear } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hoursText, issueCertificate } from '../services/admin';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { Button, Chip, Field, IconButton, Input, Textarea } from './ui';
import { t } from '../i18n';

export const certificateNumber = (c) => `PG-${new Date(c.issuedAt).getFullYear()}-${c.id.slice(0, 6).toUpperCase()}`;

// Сертификаты списком: значок цвета вида сертификата, название и дата. Открываются на отдельной странице.
export function CertificateList({ items, onRemove, className }) {
  return (
    <ul className={className ? `certs ${className}` : 'certs'}>
      {items.map((c) => (
        <li key={c.id} className="cert-badge" style={{ '--cert-accent': CERTIFICATE_MAP[c.type]?.color }}>
          <Link to={`/certificate/${c.id}`} className="cert-badge__link">
            <span className="cert-badge__icon">
              <CertificateIcon size={22} weight="fill" />
            </span>
            <span className="cert-badge__text">
              <strong>{c.title}</strong>
              <span>{fmtDateYear(c.issuedAt)}</span>
            </span>
          </Link>
          {onRemove && <IconButton icon={TrashIcon} label={t('Отозвать сертификат')} size="sm" variant="ghost" onClick={() => onRemove(c)} />}
        </li>
      ))}
    </ul>
  );
}

// Выдать сертификат. stats — { sessions, minutes } для текста «за N часов…», type — вид по умолчанию.
export function IssueCertificateSheet({ open, onClose, recipient, stats, type: initialType = 'gratitude' }) {
  const { user: admin } = useAuth();
  const toast = useToast();
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = (id) => {
    const meta = CERTIFICATE_MAP[id];
    setType(id);
    setTitle(id === 'custom' ? '' : meta.label);
    setText(id === 'hours' && stats?.minutes ? t('за {hoursText} помощи детям на платформе Pingo', { hoursText: hoursText(stats.minutes) }) : meta.text);
  };

  useEffect(() => {
    if (open) pick(initialType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await issueCertificate(admin, { userId: recipient.id, type, title, text });
      toast.success(t('Сертификат выдан: {name}', { name: recipient.name }));
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open && !!recipient}
      onClose={onClose}
      title={t('Выдать сертификат')}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            {t('Назад')}
          </Button>
          <Button variant="primary" icon={CertificateIcon} loading={busy} onClick={submit}>
            {t('Выдать')}
          </Button>
        </>
      }
    >
      {recipient && (
        <div className="person-card">
          <Avatar avatar={recipient.avatar} name={recipient.name} size={48} />
          <div>
            <strong>{recipient.name}</strong>
            <span>{t('Получит уведомление и сможет распечатать сертификат')}</span>
          </div>
        </div>
      )}
      <div className="chips chips--wrap">
        {CERTIFICATE_TYPES.map((t) => (
          <Chip key={t.id} active={type === t.id} dot={t.color} onClick={() => pick(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      <Field label={t('Название')} htmlFor="cert-title" counter={`${title.length}/80`}>
        <Input id="cert-title" value={title} maxLength={80} placeholder={t('Например, «Лучший наставник осени»')} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t('За что')} optional counter={`${text.length}/300`}>
        <Textarea value={text} maxLength={300} rows={3} placeholder={t('за помощь детям…')} onChange={(e) => setText(e.target.value)} />
      </Field>
    </Sheet>
  );
}
