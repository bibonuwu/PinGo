import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { motion } from 'framer-motion';
import { ArrowsClockwiseIcon, CaretRightIcon, IdentificationCardIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { cx, fmtAgo } from '../../lib/utils';
import { kindLabel } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { Input, StatusBadge, Stagger, StaggerItem, Tabs } from '../../components/ui';

const TABS = [
  { value: 'pending', label: 'На проверке' },
  { value: 'approved', label: 'Одобренные' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: 'all', label: 'Все' },
];

export default function AdminProfiles() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'pending';
  const setTab = (v) => setParams(v === 'pending' ? {} : { tab: v }, { replace: true });
  const [query, setQuery] = useState('');
  const rows = useLiveQuery(async () => {
    // Черновики модератору не показываем — их ещё не отправляли.
    const profiles = (await db.profiles.toArray()).filter((p) => p.status !== 'draft');
    const users = await db.users.bulkGet(profiles.map((p) => p.id));
    // Анкеты модераторов (бывших специалистов) в списке не нужны.
    return profiles.map((p, i) => ({ profile: p, user: users[i] })).filter((r) => r.user && r.user.role !== 'admin');
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: 0 };
    for (const r of rows ?? []) {
      c[r.profile.status] += 1;
      c.all += 1;
    }
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? [])
      .filter((r) => tab === 'all' || r.profile.status === tab)
      .filter((r) => !q || `${r.user.name} ${r.user.email} ${r.profile.draft.title}`.toLowerCase().includes(q))
      .sort((a, b) =>
        tab === 'pending' ? a.profile.submittedAt - b.profile.submittedAt : (b.profile.updatedAt ?? 0) - (a.profile.updatedAt ?? 0),
      );
  }, [rows, tab, query]);

  if (!rows) return <div className="page page--loading" />;

  return (
    <div className="page">
      <PageHeader title="Анкеты" subtitle="Проверьте анкеты волонтёров и специалистов перед публикацией в каталоге." />
      <div className="admin-stats">
        {[
          ['На проверке', counts.pending, 'yellow'],
          ['Одобрено', counts.approved, 'green'],
          ['Отклонено', counts.rejected, 'red'],
        ].map(([label, value, tone], i) => (
          <motion.div
            key={label}
            className={`admin-stat admin-stat--${tone}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <strong>{value}</strong>
            <span>{label}</span>
          </motion.div>
        ))}
      </div>
      <Tabs value={tab} onChange={setTab} layoutId="admin-tabs" items={TABS.map((t) => ({ ...t, count: t.value === 'pending' ? counts.pending : 0 }))} />
      <Input icon={MagnifyingGlassIcon} type="search" placeholder="Имя, email или заголовок" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск анкет" />

      {list.length === 0 ? (
        <EmptyState
          icon={IdentificationCardIcon}
          title={tab === 'pending' ? 'Все анкеты проверены' : 'Ничего не найдено'}
          text={tab === 'pending' ? 'Новые анкеты появятся здесь — я пришлю уведомление.' : 'Попробуйте другой фильтр.'}
        />
      ) : (
        <Stagger key={tab} as="ul" className="admin-list">
          {list.map(({ profile, user }) => {
            const isUpdate = profile.status === 'pending' && profile.published;
            return (
              <StaggerItem as="li" key={profile.id}>
                <Link to={`/admin/profiles/${profile.id}`} className={cx('admin-row', profile.status === 'pending' && 'is-pending')}>
                  <Avatar avatar={user.avatar} name={user.name} size={52} />
                  <span className="admin-row__body">
                    <span className="admin-row__top">
                      <strong>{user.name}</strong>
                      <span className="kind-tag kind-tag--sm">{kindLabel(profile.draft.kind)}</span>
                      {isUpdate && (
                        <span className="tag tag--blue">
                          <ArrowsClockwiseIcon size={12} weight="bold" /> обновление
                        </span>
                      )}
                    </span>
                    <span className="admin-row__title">{profile.draft.title || 'Без заголовка'}</span>
                    <span className="admin-row__meta">
                      {profile.status === 'pending'
                        ? `Отправлена ${fmtAgo(profile.submittedAt)}`
                        : `Решение ${fmtAgo(profile.reviewedAt ?? profile.updatedAt)}`}
                    </span>
                  </span>
                  <StatusBadge kind="profile" status={profile.status} />
                  <CaretRightIcon size={18} weight="bold" className="admin-row__caret" />
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
