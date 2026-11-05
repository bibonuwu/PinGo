import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CertificateIcon, InfoIcon, MagnifyingGlassIcon, RankingIcon, SealCheckIcon } from '@phosphor-icons/react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { monthAgo, useSessionStats } from '../../hooks/useAdminStats';
import { db } from '../../lib/db';
import { cx, fmtHours } from '../../lib/utils';
import { averageRating, profileKind, ratingScore } from '../../services/admin';
import { kindLabel } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { IssueCertificateSheet } from '../../components/Certificate';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { Button, Chip, IconButton, Input, Rating, Stagger, StaggerItem, Tabs } from '../../components/ui';

const PERIODS = [
  { value: 'all', label: 'За всё время' },
  { value: 'month', label: 'За 30 дней' },
];
const KINDS = [
  { id: 'all', label: 'Все' },
  { id: 'volunteer', label: 'Волонтёры' },
  { id: 'specialist', label: 'Специалисты' },
];
const SORTS = [
  { id: 'score', label: 'По рейтингу' },
  { id: 'sessions', label: 'По занятиям' },
  { id: 'minutes', label: 'По часам' },
];

const statValue = (stats, row, field, fmt = (v) => v) => {
  if (!stats) return '…';
  const s = stats[row.id];
  return s ? fmt(s[field]) : '—';
};

export default function AdminRating() {
  const [period, setPeriod] = useState('all');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('score');
  const [query, setQuery] = useState('');
  const [award, setAward] = useState(null);
  const since = useMemo(() => (period === 'month' ? monthAgo() : null), [period]);

  const base = useLiveQuery(async () => {
    const profiles = (await db.profiles.toArray()).filter((p) => p.published);
    const [users, reviews, certificates] = await Promise.all([
      db.users.bulkGet(profiles.map((p) => p.id)),
      db.reviews.toArray(),
      db.certificates.toArray(),
    ]);
    return profiles
      .map((p, i) => ({
        id: p.id,
        profile: p,
        user: users[i],
        kind: profileKind(p),
        reviews: reviews.filter((r) => r.specialistId === p.id),
        certs: certificates.filter((c) => c.userId === p.id).length,
      }))
      .filter((r) => r.user && r.user.role === 'specialist');
  }, []);

  const ids = useMemo(() => (base ?? []).map((r) => r.id).sort(), [base]);
  const stats = useSessionStats(ids, since);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (base ?? [])
      .filter((r) => kind === 'all' || r.kind === kind)
      .filter((r) => !q || `${r.user.name} ${r.user.email} ${r.profile.published.title}`.toLowerCase().includes(q))
      .map((r) => {
        const reviews = since ? r.reviews.filter((x) => x.createdAt >= since) : r.reviews;
        const s = stats?.[r.id];
        return { ...r, avg: averageRating(reviews), count: reviews.length, score: ratingScore(reviews), sessions: s?.sessions ?? 0, minutes: s?.minutes ?? 0 };
      });
    const by = {
      score: (a, b) => b.score - a.score || b.count - a.count || b.sessions - a.sessions,
      sessions: (a, b) => b.sessions - a.sessions || b.score - a.score,
      minutes: (a, b) => b.minutes - a.minutes || b.score - a.score,
    }[sort];
    return list.sort(by);
  }, [base, kind, query, since, stats, sort]);

  if (!base) return <div className="page page--loading" />;

  // Какой сертификат предложить: «Волонтёр месяца» за месяц, «Часы» при сортировке по часам, иначе «Высокий рейтинг».
  const suggestType = (r) => (sort === 'minutes' ? 'hours' : r.kind === 'volunteer' && period === 'month' ? 'volunteer_month' : 'top_rated');
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="page">
      <PageHeader
        title="Рейтинг"
        subtitle="Лучшие волонтёры и специалисты по оценкам родителей и проведённым занятиям. Отметьте лучших сертификатом."
      />
      <Tabs value={period} onChange={setPeriod} layoutId="rating-period" items={PERIODS} />
      <div className="filters-row">
        <div className="chips">
          {KINDS.map((k) => (
            <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </Chip>
          ))}
        </div>
        <div className="chips">
          {SORTS.map((s) => (
            <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>
      <Input icon={MagnifyingGlassIcon} type="search" placeholder="Имя, email или заголовок" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск в рейтинге" />

      {rows.length === 0 ? (
        <EmptyState icon={RankingIcon} title="Пока некого оценивать" text="Здесь появятся волонтёры и специалисты из каталога." />
      ) : (
        <>
          <Stagger key={`${period}-${kind}-${sort}`} className="podium">
            {podium.map((r, i) => (
              <StaggerItem key={r.id} className={`podium__card podium__card--${i + 1}`}>
                <Link to={`/admin/profiles/${r.id}`} className="card-link" aria-label={`${r.user.name} — открыть анкету`} />
                <span className={`place place--${i + 1}`}>{i + 1}</span>
                <Avatar avatar={r.user.avatar} name={r.user.name} size={64} ring />
                <strong className="podium__name">
                  {r.user.name}
                  {r.profile.verifiedAt && <SealCheckIcon size={18} weight="fill" className="ico-verified" aria-label="Подтверждён" />}
                </strong>
                <span className={cx('kind-tag kind-tag--sm', r.kind === 'volunteer' && 'kind-tag--volunteer')}>{kindLabel(r.kind)}</span>
                <Rating rating={r.avg} count={r.count} />
                <dl className="podium__stats">
                  <div>
                    <dt>занятий</dt>
                    <dd>{statValue(stats, r, 'sessions')}</dd>
                  </div>
                  <div>
                    <dt>часов</dt>
                    <dd>{statValue(stats, r, 'minutes', fmtHours)}</dd>
                  </div>
                  <div>
                    <dt>наград</dt>
                    <dd>{r.certs}</dd>
                  </div>
                </dl>
                <Button size="sm" variant={i === 0 ? 'dark' : 'soft'} icon={CertificateIcon} onClick={() => setAward({ row: r, type: suggestType(r) })} className="podium__btn">
                  Сертификат
                </Button>
              </StaggerItem>
            ))}
          </Stagger>

          {rest.length > 0 && (
            <Stagger key={`list-${period}-${kind}-${sort}`} as="ol" className="rank-list" start={4}>
              {rest.map((r, i) => (
                <StaggerItem as="li" key={r.id} className="rank-row">
                  <span className="rank-row__place">{i + 4}</span>
                  <Link to={`/admin/profiles/${r.id}`} className="rank-row__who">
                    <Avatar avatar={r.user.avatar} name={r.user.name} size={44} />
                    <span>
                      <strong>
                        {r.user.name}
                        {r.profile.verifiedAt && <SealCheckIcon size={16} weight="fill" className="ico-verified" aria-label="Подтверждён" />}
                      </strong>
                      <span className="muted small">{kindLabel(r.kind)}</span>
                    </span>
                  </Link>
                  <Rating rating={r.avg} count={r.count} />
                  <span className="rank-row__stat">
                    <strong>{statValue(stats, r, 'sessions')}</strong> зан.
                  </span>
                  <span className="rank-row__stat">
                    <strong>{statValue(stats, r, 'minutes', fmtHours)}</strong>
                  </span>
                  <IconButton icon={CertificateIcon} label="Выдать сертификат" size="sm" onClick={() => setAward({ row: r, type: suggestType(r) })} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}

      <motion.p className="hint-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <InfoIcon size={18} weight="bold" />
        <span>
          Рейтинг — средняя оценка с поправкой на число отзывов: без отзывов — 4,0, и каждый новый отзыв приближает его к настоящей
          средней. Так пара оценок «5» не обгоняет двадцать оценок «4,8». Занятия и часы — проведённые подтверждённые записи.
        </span>
      </motion.p>

      <IssueCertificateSheet
        open={!!award}
        onClose={() => setAward(null)}
        recipient={award?.row.user}
        stats={award ? stats?.[award.row.id] : null}
        type={award?.type}
      />
    </div>
  );
}
