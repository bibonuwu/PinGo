import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRightIcon,
  CertificateIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  HandHeartIcon,
  MagnifyingGlassIcon,
  ProhibitIcon,
  SealCheckIcon,
} from '@phosphor-icons/react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useSessionStats } from '../../hooks/useAdminStats';
import { db } from '../../lib/db';
import { cx, fmtDateYear, fmtHours, pluralize } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { averageRating, profileKind, unverifyProfile, verifyProfile } from '../../services/admin';
import { trainingProgress } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { IssueCertificateSheet } from '../../components/Certificate';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog, ReasonDialog } from '../../components/Sheet';
import { Button, Input, Rating, StatusBadge, Stagger, StaggerItem, Tabs } from '../../components/ui';

const TABS = [
  { value: 'waiting', label: 'Ждут подтверждения' },
  { value: 'verified', label: 'Подтверждённые' },
  { value: 'all', label: 'Все' },
];

const UNVERIFY_TEMPLATES = ['Поступили жалобы от родителей.', 'Документы не подтвердились.', 'Волонтёр давно не проводит занятия.'];

export default function AdminVolunteers() {
  const { user: admin } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'waiting';
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null); // { kind: 'verify' | 'unverify' | 'cert', row }

  const base = useLiveQuery(async () => {
    const profiles = (await db.profiles.toArray()).filter((p) => p.status !== 'draft' && profileKind(p) === 'volunteer');
    const [users, reviews, complaints, certificates] = await Promise.all([
      db.users.bulkGet(profiles.map((p) => p.id)),
      db.reviews.toArray(),
      db.complaints.toArray(),
      db.certificates.toArray(),
    ]);
    return profiles
      .map((p, i) => {
        const own = reviews.filter((r) => r.specialistId === p.id);
        return {
          id: p.id,
          profile: p,
          user: users[i],
          avg: averageRating(own),
          count: own.length,
          openComplaints: complaints.filter((c) => c.targetId === p.id && c.status === 'open').length,
          certs: certificates.filter((c) => c.userId === p.id).length,
        };
      })
      .filter((r) => r.user && r.user.role === 'specialist');
  }, []);

  const ids = useMemo(() => (base ?? []).filter((r) => r.profile.published).map((r) => r.id).sort(), [base]);
  const stats = useSessionStats(ids);

  const counts = useMemo(() => {
    const list = base ?? [];
    return {
      waiting: list.filter((r) => r.profile.published && !r.profile.verifiedAt).length,
      verified: list.filter((r) => r.profile.verifiedAt).length,
    };
  }, [base]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (base ?? [])
      .filter((r) => (tab === 'waiting' ? r.profile.published && !r.profile.verifiedAt : tab === 'verified' ? r.profile.verifiedAt : true))
      .filter((r) => !q || `${r.user.name} ${r.user.email}`.toLowerCase().includes(q))
      .sort((a, b) => (stats?.[b.id]?.minutes ?? 0) - (stats?.[a.id]?.minutes ?? 0) || b.count - a.count);
  }, [base, tab, query, stats]);

  if (!base) return <div className="page page--loading" />;

  const totalMinutes = stats ? Object.values(stats).reduce((s, x) => s + (x?.minutes ?? 0), 0) : null;
  const row = dialog?.row;

  return (
    <div className="page">
      <PageHeader title="Волонтёры" subtitle="Подтвердите волонтёров, которых проверили: родители увидят отметку «Подтверждён» в каталоге." />
      <div className="admin-stats">
        <div className="admin-stat admin-stat--yellow">
          <strong>{counts.waiting}</strong>
          <span>ждут подтверждения</span>
        </div>
        <div className="admin-stat admin-stat--green">
          <strong>{counts.verified}</strong>
          <span>подтверждено</span>
        </div>
        <div className="admin-stat admin-stat--blue">
          <strong>{totalMinutes == null ? '…' : fmtHours(totalMinutes)}</strong>
          <span>помощи детям</span>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={(v) => setParams(v === 'waiting' ? {} : { tab: v }, { replace: true })}
        layoutId="volunteer-tabs"
        items={TABS.map((t) => ({ ...t, count: t.value === 'waiting' ? counts.waiting : 0 }))}
      />
      <Input icon={MagnifyingGlassIcon} type="search" placeholder="Имя или email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск волонтёров" />

      {list.length === 0 ? (
        <EmptyState
          icon={HandHeartIcon}
          title={tab === 'waiting' ? 'Все волонтёры подтверждены' : 'Никого не нашли'}
          text={tab === 'waiting' ? 'Когда модератор одобрит новую анкету волонтёра, она появится здесь.' : 'Попробуйте другой фильтр.'}
        />
      ) : (
        <Stagger key={tab} as="ul" className="vol-list">
          {list.map((r) => {
            const p = r.profile;
            const s = stats?.[r.id];
            const training = trainingProgress(p);
            const docs = (p.published ?? p.draft).documents.length;
            const checks = [
              { done: !!p.published, label: p.published ? 'Анкета в каталоге' : 'Анкета ещё не в каталоге' },
              { done: training.complete, label: `Обучение Pingo · ${training.done}/${training.total}` },
              { done: docs > 0, label: docs ? `Документы · ${docs}` : 'Документы не прикреплены' },
              { done: (s?.sessions ?? 0) > 0, label: s ? `Проведено ${pluralize(s.sessions, ['занятие', 'занятия', 'занятий'])}` : 'Занятия — считаем…' },
              { done: r.openComplaints === 0, label: r.openComplaints ? `Открытые жалобы · ${r.openComplaints}` : 'Жалоб нет' },
            ];
            return (
              <StaggerItem as="li" key={r.id} className={cx('vol-card', p.verifiedAt && 'is-verified')}>
                <div className="vol-card__head">
                  <Avatar avatar={r.user.avatar} name={r.user.name} size={56} />
                  <div className="vol-card__who">
                    <strong>
                      {r.user.name}
                      {p.verifiedAt && <SealCheckIcon size={18} weight="fill" className="ico-verified" aria-label="Подтверждён" />}
                    </strong>
                    <span>{(p.published ?? p.draft).title || 'Без заголовка'}</span>
                    <span className="muted small">{p.verifiedAt ? `Подтверждён ${fmtDateYear(p.verifiedAt)}` : r.user.email}</span>
                  </div>
                  <StatusBadge kind="profile" status={p.status} />
                </div>
                <dl className="vol-card__stats">
                  <div>
                    <dt>Занятий</dt>
                    <dd>{p.published ? (stats ? (s ? s.sessions : '—') : '…') : 0}</dd>
                  </div>
                  <div>
                    <dt>Часов</dt>
                    <dd>{p.published ? (stats ? (s ? fmtHours(s.minutes) : '—') : '…') : '0 ч'}</dd>
                  </div>
                  <div>
                    <dt>Оценка</dt>
                    <dd>
                      <Rating rating={r.avg} count={r.count} />
                    </dd>
                  </div>
                  <div>
                    <dt>Сертификатов</dt>
                    <dd>{r.certs}</dd>
                  </div>
                </dl>
                <ul className="checklist checklist--compact">
                  {checks.map((c) => (
                    <li key={c.label} className={c.done ? 'checklist__item is-done' : 'checklist__item'}>
                      {c.done ? <CheckCircleIcon size={18} weight="fill" /> : <CircleIcon size={18} weight="bold" />} {c.label}
                    </li>
                  ))}
                </ul>
                <div className="btn-row">
                  {p.published && !p.verifiedAt && (
                    <Button size="sm" variant="primary" icon={CheckIcon} onClick={() => setDialog({ kind: 'verify', row: r })}>
                      Подтвердить
                    </Button>
                  )}
                  {p.published && (
                    <Button size="sm" variant="soft" icon={CertificateIcon} onClick={() => setDialog({ kind: 'cert', row: r })}>
                      Сертификат
                    </Button>
                  )}
                  <Link to={`/admin/profiles/${r.id}`} className="btn btn--soft btn--sm">
                    <span>Анкета</span>
                    <ArrowRightIcon size={18} weight="bold" />
                  </Link>
                  {p.verifiedAt && (
                    <Button size="sm" variant="danger-ghost" icon={ProhibitIcon} onClick={() => setDialog({ kind: 'unverify', row: r })}>
                      Снять подтверждение
                    </Button>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <ConfirmDialog
        open={dialog?.kind === 'verify'}
        onClose={() => setDialog(null)}
        title="Подтвердить волонтёра?"
        text={row ? `${row.user.name} получит отметку «Подтверждённый волонтёр» в каталоге и уведомление.` : ''}
        confirmLabel="Подтвердить"
        tone="primary"
        onConfirm={() => verifyProfile(admin.id, row.id).then(() => toast.success('Волонтёр подтверждён'))}
      />
      <ReasonDialog
        open={dialog?.kind === 'unverify'}
        onClose={() => setDialog(null)}
        title="Снять подтверждение"
        text="Анкета останется в каталоге, но без отметки «Подтверждён». Волонтёр увидит причину."
        required
        templates={UNVERIFY_TEMPLATES}
        confirmLabel="Снять"
        onConfirm={(reason) => unverifyProfile(admin.id, row.id, reason).then(() => toast.info('Подтверждение снято'))}
      />
      <IssueCertificateSheet
        open={dialog?.kind === 'cert'}
        onClose={() => setDialog(null)}
        recipient={row?.user}
        stats={row ? stats?.[row.id] : null}
        type="hours"
      />
    </div>
  );
}
