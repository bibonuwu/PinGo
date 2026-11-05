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
import { fmtAge, fmtBytes, fmtDateYear, fmtHours, fmtShortDate, fmtStamp, pluralize } from '../../lib/utils';
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
import { t } from '../../i18n';
import { reviewAuthor } from '../../i18n/stored';

const ACTIONS = {
  submitted: t('Отправлена на модерацию'),
  approved: t('Одобрена'),
  rejected: t('Отклонена'),
  revoked: t('Снята с публикации'),
  withdrawn: t('Отозвана автором'),
  verified: t('Подтверждён Pingo'),
  unverified: t('Подтверждение снято'),
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
        <PageHeader back="/admin/profiles" title={t('Анкета')} />
        <EmptyState pingo title={t('Анкета не найдена')} action={<ButtonLink to="/admin/profiles">{t('К списку')}</ButtonLink>} />
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
              <IconButton icon={ChatCircleDotsIcon} to={supportChatPath(admin.id, user)} label={t('Написать в чат: {name}', { name: user.name })} />
            )}
            <StatusBadge kind="profile" status={profile.status} size="lg" />
          </>
        }
      />

      {profile.status === 'pending' && profile.published && (
        <motion.div className="notice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <ArrowsClockwiseIcon size={22} weight="bold" />
          <div>
            <strong>{t('Обновление опубликованной анкеты')}</strong>
            <span>{t('Изменены поля:')}{' '}{changes.join(', ') || t('нет изменений')}{t('. Пока решение не принято, в каталоге прежняя версия.')}</span>
          </div>
        </motion.div>
      )}
      {openComplaints > 0 && (
        <div className="notice notice--danger">
          <ProhibitIcon size={22} weight="bold" />
          <div>
            <strong>{t('Открытые жалобы: {openComplaints}', { openComplaints })}</strong>
            <span>{t('Проверьте раздел «Жалобы» перед решением.')}</span>
          </div>
        </div>
      )}

      <div className="review-page__grid">
        <div>
          <section className="card-section">
            <div className="person-card">
              <Avatar avatar={user.avatar} name={user.name} size={64} />
              <div>
                <strong>{d.title || t('Без заголовка')}</strong>
                <span>
                  {t('Зарегистрирован(а) {date} · стаж {years}', { date: fmtDateYear(user.createdAt), years: pluralize(d.experienceYears, [t('год'), t('года'), t('лет')]) })}
                </span>
              </div>
            </div>
            <h3 className="sub-h">{t('Описание')}</h3>
            <p className="prewrap">{d.description || '—'}</p>
            <h3 className="sub-h">{t('Образование и опыт')}</h3>
            <p className="prewrap">{d.experienceText || '—'}</p>
            <h3 className="sub-h">{t('Специализации')}</h3>
            <div className="tags">
              {info.specializations.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
            <dl className="info-list">
              <dt>{t('Возраст детей')}</dt>
              <dd>
                {t('{ageMin}–{ageMax} лет', { ageMin: d.ageMin, ageMax: d.ageMax })}
              </dd>
              <dt>{t('Формат')}</dt>
              <dd>
                {info.formats.join(', ')}
                {d.formats.includes('offline') && d.city ? ` · ${d.city}` : ''}
              </dd>
              <dt>{t('Языки')}</dt>
              <dd>{info.languages.join(', ')}</dd>
              <dt>{t('Подтверждения')}</dt>
              <dd>{d.agreements.truth && d.agreements.safety ? t('Данные достоверны, правила безопасности приняты') : t('Не подтверждены')}</dd>
            </dl>
          </section>

          <section className="card-section">
            <h2>{t('Документы')}</h2>
            {d.documents.length === 0 ? (
              <p className="muted">{t('Документы не прикреплены')}{d.kind === 'specialist' ? t(' — для специалиста их стоит запросить.') : '.'}</p>
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
              {t('Отзывы')}{' '}{reviews.length > 0 && <span className="muted">· {reviews.length}</span>}
            </h2>
            {reviews.length === 0 ? (
              <p className="muted">{t('Отзывов пока нет.')}</p>
            ) : (
              <ul className="reviews">
                {reviews.map((r) => (
                  <li key={r.id} className="review">
                    <div className="review__head">
                      <strong>{reviewAuthor(r.authorName)}</strong>
                      <Stars value={r.rating} size={14} />
                    </div>
                    {r.text && <p>{r.text}</p>}
                    <div className="review__foot">
                      <span className="review__meta">{fmtShortDate(r.createdAt)}</span>
                      <button type="button" className="link-danger" onClick={() => setTarget({ kind: 'review', item: r })}>
                        {t('Удалить')}
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
            <h2>{t('Подтверждение и награды')}</h2>
            {profile.verifiedAt ? (
              <div className="verified-line">
                <SealCheckIcon size={24} weight="fill" />
                <span>
                  <strong>{volunteer ? t('Подтверждённый волонтёр') : t('Подтверждённый специалист')}</strong>
                  <span>{t('с {fmtDateYear} · родители видят отметку в каталоге', { fmtDateYear: fmtDateYear(profile.verifiedAt) })}</span>
                </span>
              </div>
            ) : (
              <p className="muted small">
                {profile.published
                  ? t('Отметки «Подтверждён» пока нет. Поставьте её, когда проверите документы и первые занятия.')
                  : t('Подтвердить можно после публикации анкеты в каталоге.')}
              </p>
            )}
            {certificates.length > 0 && <CertificateList items={certificates} onRemove={(c) => setTarget({ kind: 'cert', item: c })} />}
            <div className="btn-row">
              {profile.published && !profile.verifiedAt && (
                <Button size="sm" variant="primary" icon={SealCheckIcon} onClick={() => setDialog('verify')}>
                  {t('Подтвердить')}
                </Button>
              )}
              <Button size="sm" variant="soft" icon={CertificateIcon} onClick={() => setDialog('cert')}>
                {t('Выдать сертификат')}
              </Button>
              {profile.verifiedAt && (
                <Button size="sm" variant="danger-ghost" icon={ProhibitIcon} onClick={() => setDialog('unverify')}>
                  {t('Снять подтверждение')}
                </Button>
              )}
            </div>
          </section>

          <section className="card-section">
            <h2>{t('Обучение')}</h2>
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
            <h2>{t('Активность')}</h2>
            <p>
              {t('Записей:')}{' '}<strong>{bookings}</strong>{' '}{t('· Проведено занятий:')}{' '}<strong>{sessions === undefined ? '…' : sessions?.sessions ?? '—'}</strong>
              {sessions && (
                <>
                  {' '}
                  · <strong>{fmtHours(sessions.minutes)}</strong>
                </>
              )}{' '}{t('· Отзывов:')}{' '}<strong>{reviews.length}</strong>
              {rating && (
                <>
                  {' '}
                  · <StarIcon size={14} weight="fill" className="ico-yellow" /> <strong>{rating.replace('.', ',')}</strong>
                </>
              )}
            </p>
          </section>

          <section className="card-section">
            <h2>{t('История модерации')}</h2>
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
              {t('Отклонить')}
            </Button>
            <Button variant="primary" size="lg" icon={CheckIcon} onClick={() => setDialog('approve')}>
              {t('Одобрить')}
            </Button>
          </>
        ) : profile.published ? (
          <Button variant="danger-ghost" size="lg" icon={ProhibitIcon} onClick={() => setDialog('revoke')}>
            {t('Снять с публикации')}
          </Button>
        ) : (
          <p className="muted small">{t('Ждём, когда автор исправит анкету и отправит её снова.')}</p>
        )}
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title={profile.published ? t('Опубликовать изменения?') : t('Одобрить анкету?')}
        text={t('{name} появится в каталоге, родители смогут записываться.', { name: user.name })}
        confirmLabel={t('Одобрить')}
        tone="primary"
        onConfirm={() => approveProfile(admin.id, id).then(() => toast.success(t('Анкета одобрена')))}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title={t('Отклонить анкету')}
        text={t('Причина обязательна — автор увидит её и сможет исправить анкету.')}
        required
        templates={REJECT_TEMPLATES}
        placeholder={t('Что нужно исправить?')}
        confirmLabel={t('Отклонить')}
        onConfirm={(reason) => rejectProfile(admin.id, id, reason).then(() => toast.info(t('Анкета отклонена')))}
      />
      <ReasonDialog
        open={dialog === 'revoke'}
        onClose={() => setDialog(null)}
        title={t('Снять с публикации')}
        text={t('Анкета пропадёт из каталога. Уже созданные записи сохранятся — при необходимости отмените их вручную.')}
        required
        templates={[t('Поступили жалобы от родителей.'), t('Нарушены правила безопасности.')]}
        confirmLabel={t('Снять')}
        onConfirm={(reason) => revokeProfile(admin.id, id, reason).then(() => toast.info(t('Анкета снята с публикации')))}
      />
      <ConfirmDialog
        open={dialog === 'verify'}
        onClose={() => setDialog(null)}
        title={volunteer ? t('Подтвердить волонтёра?') : t('Подтвердить специалиста?')}
        text={t('{name} получит отметку «Подтверждён» в каталоге и уведомление.', { name: user.name })}
        confirmLabel={t('Подтвердить')}
        tone="primary"
        onConfirm={() => verifyProfile(admin.id, id).then(() => toast.success(t('Отметка «Подтверждён» поставлена')))}
      />
      <ReasonDialog
        open={dialog === 'unverify'}
        onClose={() => setDialog(null)}
        title={t('Снять подтверждение')}
        text={t('Анкета останется в каталоге, но без отметки «Подтверждён». Автор увидит причину.')}
        required
        templates={[t('Поступили жалобы от родителей.'), t('Документы не подтвердились.')]}
        confirmLabel={t('Снять')}
        onConfirm={(reason) => unverifyProfile(admin.id, id, reason).then(() => toast.info(t('Подтверждение снято')))}
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
        title={t('Удалить отзыв?')}
        text={t('Удаляйте только отзывы, которые нарушают правила: оскорбления, личные данные, спам. Рейтинг пересчитается.')}
        confirmLabel={t('Удалить')}
        tone="danger"
        onConfirm={() => deleteReview(target.item.id).then(() => toast.info(t('Отзыв удалён')))}
      />
      <ConfirmDialog
        open={target?.kind === 'cert'}
        onClose={() => setTarget(null)}
        title={t('Отозвать сертификат?')}
        text={target?.kind === 'cert' ? t('«{title}» пропадёт из анкеты, ссылка на него перестанет работать.', { title: target.item.title }) : ''}
        confirmLabel={t('Отозвать')}
        tone="danger"
        onConfirm={() => revokeCertificate(target.item.id).then(() => toast.info(t('Сертификат отозван')))}
      />
    </div>
  );
}
