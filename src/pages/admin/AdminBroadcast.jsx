import { useMemo, useState } from 'react';
import { MegaphoneIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { db } from '../../lib/db';
import { BROADCAST_AUDIENCES, BROADCAST_AUDIENCE_MAP } from '../../lib/constants';
import { fmtStamp, pluralize } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { broadcastRecipients, sendBroadcast } from '../../services/admin';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/Sheet';
import { Button, Chip, Field, Input, Stagger, StaggerItem, Textarea } from '../../components/ui';

const TEMPLATES = [
  { title: 'Новое в Pingo', body: 'Мы обновили приложение: теперь …' },
  { title: 'Спасибо, волонтёры! 💛', body: 'Благодарим всех, кто помогал детям в этом месяце. Вы делаете большое дело.' },
  { title: 'Технические работы', body: 'Сегодня с 23:00 до 23:30 приложение может работать с перебоями.' },
];

export default function AdminBroadcast() {
  const { user } = useAuth();
  const toast = useToast();
  const [audience, setAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');

  // Число получателей зависит от зеркала: живой запрос пересчитывает его при каждом изменении.
  const sizes = useLiveQuery(async () => Object.fromEntries(BROADCAST_AUDIENCES.map((a) => [a.id, broadcastRecipients(a.id).length])), []);
  const history = useLiveQuery(async () => (await db.broadcasts.toArray()).sort((a, b) => b.sentAt - a.sentAt), []);
  const count = sizes?.[audience] ?? 0;

  const preview = useMemo(() => ({ title: title.trim() || 'Заголовок сообщения', body: body.trim() || 'Текст сообщения' }), [title, body]);

  const ask = () => {
    if (title.trim().length < 3) return setError('Заголовок — минимум 3 символа');
    if (!count) return setError('В этой группе пока нет пользователей');
    setError('');
    setConfirm(true);
  };

  return (
    <div className="page broadcast">
      <PageHeader back="/admin/users" title="Рассылки" subtitle="Сообщение придёт в уведомления Pingo и на устройство, если уведомления включены." />

      <div className="broadcast__grid">
        <section className="card-section">
          <h2>Новое сообщение</h2>
          <Field label="Кому">
            <div className="chips chips--wrap">
              {BROADCAST_AUDIENCES.map((a) => (
                <Chip key={a.id} active={audience === a.id} onClick={() => setAudience(a.id)}>
                  {a.label} · {sizes?.[a.id] ?? '…'}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="chips chips--wrap">
            {TEMPLATES.map((t) => (
              <Chip
                key={t.title}
                onClick={() => {
                  setTitle(t.title);
                  setBody(t.body);
                }}
              >
                {t.title}
              </Chip>
            ))}
          </div>
          <Field label="Заголовок" htmlFor="bc-title" error={error} counter={`${title.length}/80`}>
            <Input
              id="bc-title"
              value={title}
              maxLength={80}
              placeholder="Например, «Новое в Pingo»"
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
            />
          </Field>
          <Field label="Текст" optional counter={`${body.length}/500`}>
            <Textarea value={body} maxLength={500} rows={4} placeholder="О чём рассказать пользователям?" onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div className="notif-preview" aria-label="Так увидят сообщение">
            <span className="notif-preview__icon">
              <MegaphoneIcon size={20} weight="fill" />
            </span>
            <span>
              <strong>{preview.title}</strong>
              <span>{preview.body}</span>
            </span>
          </div>
          <Button variant="primary" size="lg" icon={PaperPlaneTiltIcon} onClick={ask} disabled={!sizes}>
            Отправить · {pluralize(count, ['получатель', 'получателя', 'получателей'])}
          </Button>
        </section>

        <section className="card-section">
          <h2>История</h2>
          {!history?.length ? (
            <p className="muted">Рассылок пока не было.</p>
          ) : (
            <Stagger as="ul" className="bc-history">
              {history.map((b) => (
                <StaggerItem as="li" key={b.id} className="bc-item">
                  <div className="bc-item__head">
                    <strong>{b.title}</strong>
                    <span className="tag">{BROADCAST_AUDIENCE_MAP[b.audience]?.label}</span>
                  </div>
                  {b.body && <p>{b.body}</p>}
                  <span className="muted small">
                    {fmtStamp(b.sentAt)} · {pluralize(b.count, ['получатель', 'получателя', 'получателей'])}
                    {b.sentByName ? ` · ${b.sentByName}` : ''}
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Отправить рассылку?"
        text={`«${title.trim()}» получат ${pluralize(count, ['пользователь', 'пользователя', 'пользователей'])} (${BROADCAST_AUDIENCE_MAP[audience].label.toLowerCase()}). Отменить отправку будет нельзя.`}
        confirmLabel="Отправить"
        tone="primary"
        onConfirm={async () => {
          const sent = await sendBroadcast(user, { audience, title, body });
          toast.success(`Отправлено: ${pluralize(sent, ['получатель', 'получателя', 'получателей'])}`);
          setTitle('');
          setBody('');
        }}
      />
    </div>
  );
}
