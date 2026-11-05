import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { motion } from 'framer-motion';
import {
  ArrowsClockwiseIcon,
  CertificateIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  FileTextIcon,
  ProhibitIcon,
  SealCheckIcon,
  StarIcon,
  XIcon,
} from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { REJECT_TEMPLATES, TRAINING_MODULES } from '../../lib/constants';
import { fmtAge, fmtBytes, fmtDateYear, fmtHours, fmtShortDate, fmtStamp } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBookingsCount } from '../../hooks/useBookings';
import { useSessionStats } from '../../hooks/useAdminStats';
import { openFile } from '../../services/files';
import { approveProfile, changedFields, describeProfile, kindLabel, rejectProfile, revokeProfile } from '../../services/profiles';
import { deleteReview, profileKind, revokeCertificate, unverifyProfile, verifyProfile } from '../../services/admin';
import { supportChatPath } from '../../services/chat';
import { Avatar } from '../../components/Avatar';
import { CertificateList, IssueCertificateSheet } from '../../components/Certificate';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog, ReasonDialog } from '../../components/Sheet';
import { Button, ButtonLink, IconButton, StatusBadge, Stars } from '../../components/ui';

const ACTIONS = {
  submitted: 'Отправлена на модерацию',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  revoked: 'Снята с публикации',
  withdrawn: 'Отозвана автором',
  verified: 'Подтверждён Pingo',
  unverified: 'Подтверждение снято',
};
const GOOD = ['approved', 'verified'];
const BAD = ['rejected', 'revoked', 'unverified'];

export default function AdminProfileReview() {
  const { id } = useParams();
  const { user: admin } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState(null);
  const [target, setTarget] = useState(null); // отзыв или сертификат, который удаляем
  const bookings = useBookingsCount(id);
  const sessions = useSessionStats([id])?.[id];
  const data = useLiveQuery(async () => {
    const profile = await db.profiles.get(id);
    if (!profile) return null;
    const [user, reviews, complaints, certificates] = await Promise.all([
      db.users.get(id),
      db.reviews.where('specialistId').equals(id).toArray(),
      db.complaints.where('targetId').equals(id).toArray(),
      db.certificates.where('userId').equals(id).toArray(),
    ]);
    return {
      profile,
      user,
      reviews: reviews.sort((a, b) => b.createdAt - a.createdAt),
      complaints,
      certificates: certificates.sort((a, b) => b.issuedAt - a.issuedAt),
    };
  }, [id]);

  if (data === undefined) return <div className="page page--loading" />;
  if (!data?.user) {
    return (
      <div className="page">
        <PageHeader back="/admin/profiles" title="Анкета" />
        <EmptyState pingo title="Анкета не найдена" action={<ButtonLink to="/admin/profiles">К списку</ButtonLink>} />
      </div>
    );
  }

  const { profile, user, reviews, complaints, certificates } = data;
  const d = profile.draft;
  const volunteer = profileKind(profile) === 'volunteer';
  const info = describeProfile(d);
  const changes = changedFields(profile);
  const rating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const openComplaints = complaints.filter((c) => c.status === 'open').length;

  return (
    <div className="page review-page">
      <PageHeader
        back="/admin/profiles"
        title={user.name}
        subtitle={`${kindLabel(d.kind)} · ${user.email}`}
        actions={
          <>
            {user.role === 'specialist' && (
              <IconButton icon={ChatCircleDotsIcon} to={supportChatPath(admin.id, user)} label={`Написать в чат: ${user.name}`} />
            )}
            <StatusBadge kind="profile" status={profile.status} size="lg" />
          </>
        }
      />

      {profile.status === 'pending' && profile.published && (
        <motion.div className="notice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <ArrowsClockwiseIcon size={22} weight="bold" />
          <div>
            <strong>Обновление опубликованной анкеты</strong>
            <span>Изменены поля: {changes.join(', ') || 'нет изменений'}. Пока решение не принято, в каталоге прежняя версия.</span>
          </div>
        </motion.div>
      )}
      {openComplaints > 0 && (
        <div className="notice notice--danger">
          <ProhibitIcon size={22} weight="bold" />
          <div>
            <strong>Открытые жалобы: {openComplaints}</strong>
            <span>Проверьте раздел «Жалобы» перед решением.</span>
          </div>
        </div>
      )}

      <div className="review-page__grid">
        <div>
          <section className="card-section">
            <div className="person-card">
              <Avatar avatar={user.avatar} name={user.name} size={64} />
              <div>
                <strong>{d.title || 'Без заголовка'}</strong>
                <span>
                  Зарегистрирован(а) {fmtDateYear(user.createdAt)} · стаж {fmtAge(d.experienceYears)}
                </span>
              </div>
            </div>
            <h3 className="sub-h">Описание</h3>
            <p className="prewrap">{d.description || '—'}</p>
            <h3 className="sub-h">Образование и опыт</h3>
            <p className="prewrap">{d.experienceText || '—'}</p>
            <h3 className="sub-h">Специализации</h3>
            <div className="tags">
              {info.specializations.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
            <dl className="info-list">
              <dt>Возраст детей</dt>
              <dd>
                {d.ageMin}–{d.ageMax} лет
              </dd>
              <dt>Формат</dt>
              <dd>
                {info.formats.join(', ')}
                {d.formats.includes('offline') && d.city ? ` · ${d.city}` : ''}
              </dd>
              <dt>Языки</dt>
              <dd>{info.languages.join(', ')}</dd>
              <dt>Подтверждения</dt>
              <dd>{d.agreements.truth && d.agreements.safety ? 'Данные достоверны, правила безопасности приняты' : 'Не подтверждены'}</dd>
            </dl>
          </section>

          <section className="card-section">
            <h2>Документы</h2>
            {d.documents.length === 0 ? (
              <p className="muted">Документы не прикреплены{d.kind === 'specialist' ? ' — для специалиста их стоит запросить.' : '.'}</p>
            ) : (
              <ul className="docs">
                {d.documents.map((doc) => (
                  <li key={doc.id}>
                    <button type="button" className="docs__open" onClick={() => openFile(doc).catch((e) => toast.error(e.message))}>
                      <FileTextIcon size={22} weight="fill" />
                      <span>
                        <strong>{doc.name}</strong>
                        <span>{fmtBytes(doc.size)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-section">
            <h2>
              Отзывы {reviews.length > 0 && <span className="muted">· {reviews.length}</span>}
            </h2>
            {reviews.length === 0 ? (
              <p className="muted">Отзывов пока нет.</p>
            ) : (
              <ul className="reviews">
                {reviews.map((r) => (
                  <li key={r.id} className="review">
                    <div className="review__head">
                      <strong>{r.authorName}</strong>
                      <Stars value={r.rating} size={14} />
                    </div>
                    {r.text && <p>{r.text}</p>}
                    <div className="review__foot">
                      <span className="review__meta">{fmtShortDate(r.createdAt)}</span>
                      <button type="button" className="link-danger" onClick={() => setTarget({ kind: 'review', item: r })}>
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div>
          <section className="card-section">
            <h2>Подтверждение и награды</h2>
            {profile.verifiedAt ? (
              <div className="verified-line">
                <SealCheckIcon size={24} weight="fill" />
                <span>
                  <strong>{volunteer ? 'Подтверждённый волонтёр' : 'Подтверждённый специалист'}</strong>
                  <span>с {fmtDateYear(profile.verifiedAt)} · родители видят отметку в каталоге</span>
                </span>
              </div>
            ) : (
              <p className="muted small">
                {profile.published
                  ? 'Отметки «Подтверждён» пока нет. Поставьте её, когда проверите документы и первые занятия.'
                  : 'Подтвердить можно после публикации анкеты в каталоге.'}
              </p>
            )}
            {certificates.length > 0 && <CertificateList items={certificates} onRemove={(c) => setTarget({ kind: 'cert', item: c })} />}
            <div className="btn-row">
              {profile.published && !profile.verifiedAt && (
                <Button size="sm" variant="primary" icon={SealCheckIcon} onClick={() => setDialog('verify')}>
                  Подтвердить
                </Button>
              )}
              <Button size="sm" variant="soft" icon={CertificateIcon} onClick={() => setDialog('cert')}>
                Выдать сертификат
              </Button>
              {profile.verifiedAt && (
                <Button size="sm" variant="danger-ghost" icon={ProhibitIcon} onClick={() => setDialog('unverify')}>
                  Снять подтверждение
                </Button>
              )}
            </div>
          </section>

          <section className="card-section">
            <h2>Обучение</h2>
            <ul className="checklist">
              {TRAINING_MODULES.map((m) => {
                const done = profile.trainingDone.includes(m.id);
                return (
                  <li key={m.id} className={done ? 'checklist__item is-done' : 'checklist__item'}>
                    {done ? <CheckCircleIcon size={20} weight="fill" /> : <CircleIcon size={20} weight="bold" />} {m.title}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card-section">
            <h2>Активность</h2>
            <p>
              Записей: <strong>{bookings}</strong> · Проведено занятий: <strong>{sessions === undefined ? '…' : sessions?.sessions ?? '—'}</strong>
              {sessions && (
                <>
                  {' '}
                  · <strong>{fmtHours(sessions.minutes)}</strong>
                </>
              )}{' '}
              · Отзывов: <strong>{reviews.length}</strong>
              {rating && (
                <>
                  {' '}
                  · <StarIcon size={14} weight="fill" className="ico-yellow" /> <strong>{rating.replace('.', ',')}</strong>
                </>
              )}
            </p>
          </section>

          <section className="card-section">
            <h2>История модерации</h2>
            <ol className="timeline">
              {[...profile.history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`} className={`timeline__item timeline__item--${GOOD.includes(h.action) ? 'done' : BAD.includes(h.action) ? 'bad' : 'wait'}`}>
                  <span className="timeline__dot" />
                  <span className="timeline__text">
                    {ACTIONS[h.action] ?? h.action}
                    {h.reason && <em> — {h.reason}</em>}
                  </span>
                  <time>{fmtStamp(h.at)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <div className="decision-bar">
        {profile.status === 'pending' ? (
          <>
            <Button variant="soft" size="lg" icon={XIcon} onClick={() => setDialog('reject')}>
              Отклонить
            </Button>
            <Button variant="primary" size="lg" icon={CheckIcon} onClick={() => setDialog('approve')}>
              Одобрить
            </Button>
          </>
        ) : profile.published ? (
          <Button variant="danger-ghost" size="lg" icon={ProhibitIcon} onClick={() => setDialog('revoke')}>
            Снять с публикации
          </Button>
        ) : (
          <p className="muted small">Ждём, когда автор исправит анкету и отправит её снова.</p>
        )}
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title={profile.published ? 'Опубликовать изменения?' : 'Одобрить анкету?'}
        text={`${user.name} появится в каталоге, родители смогут записываться.`}
        confirmLabel="Одобрить"
        tone="primary"
        onConfirm={() => approveProfile(admin.id, id).then(() => toast.success('Анкета одобрена'))}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Отклонить анкету"
        text="Причина обязательна — автор увидит её и сможет исправить анкету."
        required
        templates={REJECT_TEMPLATES}
        placeholder="Что нужно исправить?"
        confirmLabel="Отклонить"
        onConfirm={(reason) => rejectProfile(admin.id, id, reason).then(() => toast.info('Анкета отклонена'))}
      />
      <ReasonDialog
        open={dialog === 'revoke'}
        onClose={() => setDialog(null)}
        title="Снять с публикации"
        text="Анкета пропадёт из каталога. Уже созданные записи сохранятся — при необходимости отмените их вручную."
        required
        templates={['Поступили жалобы от родителей.', 'Нарушены правила безопасности.']}
        confirmLabel="Снять"
        onConfirm={(reason) => revokeProfile(admin.id, id, reason).then(() => toast.info('Анкета снята с публикации'))}
      />
      <ConfirmDialog
        open={dialog === 'verify'}
        onClose={() => setDialog(null)}
        title={volunteer ? 'Подтвердить волонтёра?' : 'Подтвердить специалиста?'}
        text={`${user.name} получит отметку «Подтверждён» в каталоге и уведомление.`}
        confirmLabel="Подтвердить"
        tone="primary"
        onConfirm={() => verifyProfile(admin.id, id).then(() => toast.success('Отметка «Подтверждён» поставлена'))}
      />
      <ReasonDialog
        open={dialog === 'unverify'}
        onClose={() => setDialog(null)}
        title="Снять подтверждение"
        text="Анкета останется в каталоге, но без отметки «Подтверждён». Автор увидит причину."
        required
        templates={['Поступили жалобы от родителей.', 'Документы не подтвердились.']}
        confirmLabel="Снять"
        onConfirm={(reason) => unverifyProfile(admin.id, id, reason).then(() => toast.info('Подтверждение снято'))}
      />
      <IssueCertificateSheet
        open={dialog === 'cert'}
        onClose={() => setDialog(null)}
        recipient={user}
        stats={sessions}
        type={volunteer ? 'hours' : 'gratitude'}
      />
      <ConfirmDialog
        open={target?.kind === 'review'}
        onClose={() => setTarget(null)}
        title="Удалить отзыв?"
        text="Удаляйте только отзывы, которые нарушают правила: оскорбления, личные данные, спам. Рейтинг пересчитается."
        confirmLabel="Удалить"
        tone="danger"
        onConfirm={() => deleteReview(target.item.id).then(() => toast.info('Отзыв удалён'))}
      />
      <ConfirmDialog
        open={target?.kind === 'cert'}
        onClose={() => setTarget(null)}
        title="Отозвать сертификат?"
        text={target?.kind === 'cert' ? `«${target.item.title}» пропадёт из анкеты, ссылка на него перестанет работать.` : ''}
        confirmLabel="Отозвать"
        tone="danger"
        onConfirm={() => revokeCertificate(target.item.id).then(() => toast.info('Сертификат отозван'))}
      />
    </div>
  );
}
