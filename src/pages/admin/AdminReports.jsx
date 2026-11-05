import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { ArrowRightIcon, CheckIcon, FlagIcon } from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { COMPLAINT_REASON_MAP } from '../../lib/constants';
import { fmtAgo } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { resolveComplaint } from '../../services/complaints';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ReasonDialog } from '../../components/Sheet';
import { Button, Stagger, StaggerItem, Tabs } from '../../components/ui';
import { t } from '../../i18n';

export default function AdminReports() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('open');
  const [resolving, setResolving] = useState(null);
  const rows = useLiveQuery(async () => {
    const list = await db.complaints.toArray();
    const ids = [...new Set(list.flatMap((c) => [c.reporterId, c.targetId]))];
    const users = Object.fromEntries((await db.users.bulkGet(ids)).filter(Boolean).map((u) => [u.id, u]));
    return list
      .map((c) => ({ ...c, reporter: users[c.reporterId], target: users[c.targetId] }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, []);

  if (!rows) return <div className="page page--loading" />;
  const open = rows.filter((r) => r.status === 'open');
  const list = tab === 'open' ? open : rows.filter((r) => r.status !== 'open');

  return (
    <div className="page">
      <PageHeader title={t('Жалобы')} subtitle={t('Сообщения родителей и специалистов о нарушениях. Безопасность детей — в приоритете.')} />
      <Tabs
        value={tab}
        onChange={setTab}
        layoutId="complaint-tabs"
        items={[
          { value: 'open', label: t('Открытые'), count: open.length },
          { value: 'resolved', label: t('Решённые') },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState icon={FlagIcon} title={tab === 'open' ? t('Открытых жалоб нет') : t('Пока пусто')} text={t('Здесь появятся жалобы из чатов и анкет.')} />
      ) : (
        <Stagger key={tab} as="ul" className="list">
          {list.map((c) => (
            <StaggerItem as="li" key={c.id} className="complaint">
              <div className="complaint__head">
                <Avatar avatar={c.target?.avatar} name={c.target?.name} size={44} />
                <div>
                  <strong>{c.target?.name ?? t('Пользователь удалён')}</strong>
                  <span>
                    {t('от')}{' '}{c.reporter?.name ?? t('пользователя')} · {fmtAgo(c.createdAt)}
                  </span>
                </div>
                <span className="tag tag--red">{COMPLAINT_REASON_MAP[c.reason]?.label}</span>
              </div>
              {c.details && <p className="complaint__text">{c.details}</p>}
              {c.status === 'resolved' && <p className="muted small">{t('Решение: {resolution}', { resolution: c.resolution })}</p>}
              <div className="btn-row">
                {c.target?.role === 'specialist' && (
                  <Link to={`/admin/profiles/${c.targetId}`} className="btn btn--soft btn--sm">
                    <span>{t('Открыть анкету')}</span>
                    <ArrowRightIcon size={18} weight="bold" />
                  </Link>
                )}
                {c.status === 'open' && (
                  <Button size="sm" variant="dark" icon={CheckIcon} onClick={() => setResolving(c.id)}>
                    {t('Отметить решённой')}
                  </Button>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      <ReasonDialog
        open={!!resolving}
        onClose={() => setResolving(null)}
        title={t('Закрыть жалобу')}
        text={t('Опишите, что сделано: например, предупреждение или снятие анкеты.')}
        templates={[t('Проведена беседа, нарушение не повторится.'), t('Анкета снята с публикации.'), t('Нарушение не подтвердилось.')]}
        placeholder={t('Решение')}
        tone="dark"
        confirmLabel={t('Закрыть жалобу')}
        onConfirm={(text) => resolveComplaint(resolving, user.id, text).then(() => toast.success(t('Жалоба закрыта')))}
      />
    </div>
  );
}
