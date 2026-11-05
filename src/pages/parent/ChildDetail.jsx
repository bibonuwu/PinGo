import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ClipboardTextIcon,
  PencilSimpleIcon,
  SmileyMeltingIcon,
  TrashIcon,
  TrendUpIcon,
} from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { LEARNING_STYLE_MAP, NEED_MAP, suggestAccessibility } from '../../lib/constants';
import { ageFromBirthDate, fmtAge, fmtDateYear, fmtDay, fmtRange } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBookingsFor } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { deleteChild, setActiveChild, updateChildAccessibility } from '../../services/children';
import { displayStatus, isUpcoming } from '../../services/bookings';
import { AccessibilityForm } from '../../components/AccessibilityForm';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/Sheet';
import { Button, ButtonLink } from '../../components/ui';
import { t } from '../../i18n';

export default function ChildDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(60_000);
  const child = useLiveQuery(async () => (await db.children.get(id)) ?? null, [id]);
  const bookings = useBookingsFor(user);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (child === undefined || !bookings) return <div className="page page--loading" />;
  if (!child || child.parentId !== user.id) {
    return (
      <div className="page">
        <PageHeader back="/parent/profile" title={t('Профиль ребёнка')} />
        <EmptyState icon={SmileyMeltingIcon} title={t('Профиль не найден')} action={<ButtonLink to="/parent/profile">{t('В профиль')}</ButtonLink>} />
      </div>
    );
  }

  const mine = bookings.filter((b) => b.childId === child.id);
  const history = mine.filter((b) => displayStatus(b, now) === 'completed').sort((a, b) => b.start - a.start);
  const upcoming = mine.filter((b) => isUpcoming(b, now)).sort((a, b) => a.start - b.start);
  const active = user.activeChildId === child.id;

  return (
    <div className="page child-page">
      <PageHeader
        back="/parent/profile"
        title={child.name}
        subtitle={t('{fmtAge} · с нами с {date}', { fmtAge: fmtAge(ageFromBirthDate(child.birthDate)), date: fmtDateYear(child.createdAt) })}
        actions={<ButtonLink to="edit" variant="soft" icon={PencilSimpleIcon} size="sm">{t('Изменить')}</ButtonLink>}
      />

      <div className="child-page__grid">
        <div className="child-page__main">
          <motion.section className="child-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Avatar avatar={child.avatar} name={child.name} size={96} ring />
            <div>
              {active ? (
                <span className="tag tag--yellow">
                  <CheckCircleIcon size={14} weight="fill" />{' '}{t('Активный профиль')}
                </span>
              ) : (
                <Button size="sm" variant="dark" onClick={() => setActiveChild(user.id, child.id)}>
                  {t('Выбрать для занятий')}
                </Button>
              )}
              <p className="muted small">
                {t('Активный профиль определяет подбор специалистов и настройки интерфейса.')}
              </p>
            </div>
          </motion.section>

          <section className="card-section">
            <h2>{t('Особенности')}</h2>
            {child.needs.length ? (
              <div className="tags">
                {child.needs.map((n) => (
                  <span key={n} className="tag tag--lg">
                    {n === 'other' ? child.needsOther || t('Другое') : NEED_MAP[n]?.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">{t('Не указаны')}</p>
            )}
            {child.learningStyles.length > 0 && (
              <>
                <h3 className="sub-h">{t('Как учится')}</h3>
                <div className="tags">
                  {child.learningStyles.map((s) => (
                    <span key={s} className="tag">
                      {LEARNING_STYLE_MAP[s]?.label}
                    </span>
                  ))}
                </div>
              </>
            )}
            {child.goals && (
              <>
                <h3 className="sub-h">{t('Цели')}</h3>
                <p className="prewrap">{child.goals}</p>
              </>
            )}
            {child.notes && (
              <>
                <h3 className="sub-h">{t('Важно знать специалисту')}</h3>
                <p className="prewrap">{child.notes}</p>
              </>
            )}
          </section>

          <section className="card-section">
            <h2>
              <TrendUpIcon size={22} weight="bold" />{' '}{t('Прогресс и история занятий')}
            </h2>
            {history.length === 0 ? (
              <p className="muted">{t('После первых занятий здесь появятся отчёты специалистов — так будет видно, как растёт {name}.', { name: child.name })}</p>
            ) : (
              <ol className="progress-list">
                {history.map((b) => (
                  <li key={b.id}>
                    <Link to={`/parent/bookings/${b.id}`} className="progress-item">
                      <span className="progress-item__date">{fmtDay(b.start, now)}</span>
                      <strong>{b.specialist?.name}</strong>
                      {b.report ? (
                        <span className="progress-item__text">
                          <ClipboardTextIcon size={15} weight="fill" /> {b.report.progress || b.report.summary}
                        </span>
                      ) : (
                        <span className="progress-item__text muted">{t('Отчёт ещё не добавлен')}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            {upcoming.length > 0 && (
              <p className="small">
                {t('Следующее занятие:')}{' '}<strong>{fmtDay(upcoming[0].start, now)}, {fmtRange(upcoming[0].start, upcoming[0].end)}</strong>{' '}{t('с {name}', { name: upcoming[0].specialist?.name })}
              </p>
            )}
          </section>
        </div>

        <aside className="child-page__side">
          <section className="card-section">
            <h2>{t('Доступность')}</h2>
            <p className="muted small">{active ? t('Изменения сохраняются сразу и применяются ко всему приложению.') : t('Изменения сохраняются сразу.')}</p>
            <AccessibilityForm
              idPrefix={`child-${child.id}`}
              value={child.accessibility}
              suggestion={suggestAccessibility(child.needs)}
              suggestionFor={child.name}
              onChange={(a) => updateChildAccessibility(child.id, a)}
            />
          </section>
          <Button variant="danger-ghost" icon={TrashIcon} block onClick={() => setConfirmDelete(true)}>
            {t('Удалить профиль')}
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('Удалить профиль {name}?', { name: child.name })}
        text={t('История занятий останется в записях. Активные записи нужно отменить заранее.')}
        confirmLabel={t('Удалить')}
        tone="danger"
        onConfirm={async () => {
          await deleteChild(user.id, child.id);
          toast.info(t('Профиль удалён'));
          navigate('/parent/profile', { replace: true });
        }}
      />
    </div>
  );
}
