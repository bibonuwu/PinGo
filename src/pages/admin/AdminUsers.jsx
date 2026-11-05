import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CaretRightIcon,
  ChatCircleDotsIcon,
  FileCsvIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  SealCheckIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { db } from '../../lib/db';
import { fmtDateYear, pluralize } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { exportUsersCsv, profileKind } from '../../services/admin';
import { supportChatPath, supportConversationId } from '../../services/chat';
import { kindLabel } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { Button, ButtonLink, IconButton, Input, StatusBadge, Tabs } from '../../components/ui';
import { t } from '../../i18n';

const TABS = [
  { value: 'all', label: t('Все') },
  { value: 'parents', label: t('Родители') },
  { value: 'specialists', label: t('Специалисты') },
  { value: 'volunteers', label: t('Волонтёры') },
  { value: 'admins', label: t('Модераторы') },
];
const PAGE = 60;

function groupOf(u, profile) {
  if (u.role === 'parent') return 'parents';
  if (u.role === 'admin') return 'admins';
  return profileKind(profile) === 'volunteer' ? 'volunteers' : 'specialists';
}

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'all';
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const rows = useLiveQuery(async () => {
    const users = (await db.users.toArray()).filter((u) => u.email);
    const [profiles, complaints, chats] = await Promise.all([
      db.profiles.bulkGet(users.map((u) => u.id)),
      db.complaints.toArray(),
      db.conversations.bulkGet(users.map((u) => supportConversationId(me.id, u))),
    ]);
    return users
      .map((u, i) => ({
        user: u,
        profile: u.role === 'specialist' ? profiles[i] : null,
        group: groupOf(u, profiles[i]),
        complaints: complaints.filter((c) => c.targetId === u.id).length,
        // Непрочитанные ответы в диалоге поддержки с этим модератором.
        unread: chats[i]?.unread?.[me.id] || 0,
      }))
      .sort((a, b) => (b.user.createdAt ?? 0) - (a.user.createdAt ?? 0));
  }, [me.id]);

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0 };
    for (const r of rows ?? []) c[r.group] = (c[r.group] ?? 0) + 1;
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => (tab === 'all' || r.group === tab) && (!q || `${r.user.name} ${r.user.email}`.toLowerCase().includes(q)));
  }, [rows, tab, query]);

  if (!rows) return <div className="page page--loading" />;

  const exportCsv = () => {
    exportUsersCsv(list.map((r) => r.user));
    toast.success(t('Сохранено: {pluralize}', { pluralize: pluralize(list.length, [t('пользователь'), t('пользователя'), t('пользователей')]) }));
  };

  return (
    <div className="page">
      <PageHeader
        title={t('Пользователи')}
        subtitle={t('Всего в Pingo: {pluralize}.', { pluralize: pluralize(counts.all, [t('аккаунт'), t('аккаунта'), t('аккаунтов')]) })}
        actions={
          <div className="btn-row">
            <ButtonLink to="/admin/broadcast" variant="soft" icon={MegaphoneIcon}>
              {t('Рассылка')}
            </ButtonLink>
            <Button variant="dark" icon={FileCsvIcon} onClick={exportCsv} disabled={!list.length}>
              Excel
            </Button>
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          setParams(v === 'all' ? {} : { tab: v }, { replace: true });
          setLimit(PAGE);
        }}
        layoutId="users-tabs"
        items={TABS.map((t) => ({ ...t, count: counts[t.value] ?? 0 }))}
      />
      <Input
        icon={MagnifyingGlassIcon}
        type="search"
        placeholder={t('Имя или email')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE);
        }}
        aria-label={t('Поиск пользователей')}
      />

      {list.length === 0 ? (
        <EmptyState icon={UsersThreeIcon} title={t('Никого не нашли')} text={t('Попробуйте другой фильтр или запрос.')} />
      ) : (
        <ul className="admin-list">
          {list.slice(0, limit).map(({ user: u, profile: p, group, complaints, unread }) => {
            const meta = (
              <span className="admin-row__body">
                <span className="admin-row__top">
                  <strong>{u.name}</strong>
                  {group === 'admins' && <span className="tag tag--yellow">{t('модератор')}</span>}
                  {p && <span className="kind-tag kind-tag--sm">{kindLabel(profileKind(p))}</span>}
                  {p?.verifiedAt && <SealCheckIcon size={16} weight="fill" className="ico-verified" aria-label={t('Подтверждён')} />}
                  {complaints > 0 && <span className="tag tag--red">{pluralize(complaints, [t('жалоба'), t('жалобы'), t('жалоб')])}</span>}
                </span>
                <span className="admin-row__title">{u.email}</span>
                <span className="admin-row__meta">
                  {group === 'parents' ? t('Родитель') : group === 'admins' ? t('Модератор') : t('Анкета')}{' '}{t('· с {fmtDateYear}', { fmtDateYear: fmtDateYear(u.createdAt) })}
                </span>
              </span>
            );
            const openable = p && p.status !== 'draft';
            return (
              <li key={u.id} className="user-row">
                {openable ? (
                  <Link to={`/admin/profiles/${u.id}`} className="admin-row">
                    <Avatar avatar={u.avatar} name={u.name} size={48} />
                    {meta}
                    <StatusBadge kind="profile" status={p.status} />
                    <CaretRightIcon size={18} weight="bold" className="admin-row__caret" />
                  </Link>
                ) : (
                  <div className="admin-row admin-row--static">
                    <Avatar avatar={u.avatar} name={u.name} size={48} />
                    {meta}
                    {p && <StatusBadge kind="profile" status={p.status} />}
                    {group !== 'admins' && (
                      <IconButton
                        icon={ChatCircleDotsIcon}
                        to={supportChatPath(me.id, u)}
                        label={t('Написать в чат: {name}', { name: u.name })}
                        size="sm"
                        badge={unread}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {list.length > limit && (
        <Button variant="soft" block onClick={() => setLimit((l) => l + PAGE)}>
          {t('Показать ещё · {p0}', { p0: list.length - limit })}
        </Button>
      )}
    </div>
  );
}
