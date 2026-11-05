import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { motion } from 'framer-motion';
import {
  CalendarPlusIcon,
  ChatCircleDotsIcon,
  FlagIcon,
  GlobeIcon,
  HeartIcon,
  MapPinIcon,
  SealCheckIcon,
  SparkleIcon,
  VideoCameraIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { freshSlots, useSpecialist } from '../../hooks/useCatalog';
import { useChildren } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { NEED_MAP } from '../../lib/constants';
import { db } from '../../lib/db';
import { matchChild } from '../../lib/matching';
import { cx, fmtAge, fmtDayTime, fmtShortDate, plural } from '../../lib/utils';
import { toggleFavorite } from '../../services/auth';
import { ensureConversation } from '../../services/chat';
import { describeProfile, kindLabel } from '../../services/profiles';
import { Avatar } from '../../components/Avatar';
import { CertificateList } from '../../components/Certificate';
import { ComplaintDialog } from '../../components/Chat';
import { EmptyState } from '../../components/EmptyState';
import { BackButton } from '../../components/PageHeader';
import { Button, ButtonLink, IconButton, Rating, Stars } from '../../components/ui';

export default function SpecialistDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(60_000);
  const entry = useSpecialist(id);
  const children = useChildren(user.id);
  const certificates = useLiveQuery(
    async () => (await db.certificates.where('userId').equals(id).toArray()).sort((a, b) => b.issuedAt - a.issuedAt),
    [id],
  );
  const [complaintOpen, setComplaintOpen] = useState(false);

  if (entry === undefined || !children || !certificates) return <div className="page page--loading" />;
  if (!entry?.data) {
    return (
      <div className="page">
        <BackButton to="/parent/specialists" />
        <EmptyState
          pingo
          title="Анкета недоступна"
          text="Возможно, она на модерации или специалист больше не принимает записи."
          action={<ButtonLink to="/parent/specialists">К каталогу</ButtonLink>}
        />
      </div>
    );
  }

  const { user: sp, data } = entry;
  const info = describeProfile(data);
  const activeChild = children.find((c) => c.id === user.activeChildId) ?? children[0];
  const match = activeChild ? matchChild(activeChild, data) : null;
  const slots = freshSlots(entry.slots, now);
  const favorite = user.favorites?.includes(id);
  const hasChildren = children.length > 0;

  const writeMessage = async () => {
    try {
      const convId = await ensureConversation(user.id, id);
      navigate(`/parent/messages/${convId}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const bookAction = hasChildren ? (
    <ButtonLink to="book" variant="primary" size="lg" icon={CalendarPlusIcon} block>
      Записаться на занятие
    </ButtonLink>
  ) : (
    <ButtonLink to="/parent/children/new" variant="primary" size="lg" block>
      Сначала добавьте ребёнка
    </ButtonLink>
  );

  return (
    <div className="page detail">
      <div className="detail__top">
        <BackButton to="/parent/specialists" />
        <div className="detail__top-actions">
          <IconButton
            icon={HeartIcon}
            weight={favorite ? 'fill' : 'bold'}
            label={favorite ? 'Убрать из избранного' : 'В избранное'}
            className={cx(favorite && 'is-fav')}
            onClick={() => toggleFavorite(user.id, id)}
          />
          <IconButton icon={FlagIcon} label="Пожаловаться" onClick={() => setComplaintOpen(true)} />
        </div>
      </div>

      <div className="detail__layout">
        <div className="detail__main">
          <motion.section
            className="profile-hero"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <Avatar avatar={sp.avatar} name={sp.name} size={104} ring />
            <h1 className="profile-hero__name">
              {sp.name} <SealCheckIcon size={24} weight="fill" className="ico-verified" aria-label="Анкета проверена" />
            </h1>
            <p className="profile-hero__title">{data.title}</p>
            <div className="profile-hero__meta">
              <Rating rating={entry.rating} count={entry.reviewsCount} />
              <span className={cx('kind-tag', data.kind === 'volunteer' && 'kind-tag--volunteer')}>{kindLabel(data.kind)}</span>
              {entry.profile.verifiedAt && (
                <span className="verified-tag" title="Модератор Pingo проверил документы и занятия">
                  <SealCheckIcon size={16} weight="fill" /> {data.kind === 'volunteer' ? 'Подтверждённый волонтёр' : 'Подтверждённый специалист'}
                </span>
              )}
            </div>
            <div className="facts">
              <div>
                <strong>{data.experienceYears}</strong>
                <span>{plural(data.experienceYears, ['год', 'года', 'лет'])} опыта</span>
              </div>
              <div>
                <strong>
                  {data.ageMin}–{data.ageMax}
                </strong>
                <span>возраст детей</span>
              </div>
              <div>
                <strong>{entry.sessionMinutes}</strong>
                <span>мин занятие</span>
              </div>
            </div>
          </motion.section>

          {match && (
            <motion.div
              className={cx('match-box', match.good && 'is-good', !match.ageOk && 'is-warn')}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {match.ageOk ? <SparkleIcon size={22} weight="fill" /> : <WarningIcon size={22} weight="fill" />}
              <div>
                {!match.ageOk ? (
                  <>
                    <strong>Возраст ребёнка вне практики специалиста</strong>
                    <span>
                      {activeChild.name} — {fmtAge(match.age)}, специалист работает с детьми {data.ageMin}–{data.ageMax} лет.
                    </span>
                  </>
                ) : match.good ? (
                  <>
                    <strong>Подходит · {activeChild.name}</strong>
                    <span>Помогает с запросами: {match.matchedNeeds.map((n) => NEED_MAP[n]?.label.toLowerCase()).join(', ')}.</span>
                  </>
                ) : (
                  <>
                    <strong>Подходит по возрасту</strong>
                    <span>Направления специалиста не пересекаются с отмеченными потребностями ребёнка.</span>
                  </>
                )}
              </div>
            </motion.div>
          )}

          <section className="card-section">
            <h2>О себе</h2>
            <p className="prewrap">{data.description}</p>
          </section>
          {data.experienceText && (
            <section className="card-section">
              <h2>Опыт и образование</h2>
              <p className="prewrap">{data.experienceText}</p>
            </section>
          )}
          <section className="card-section">
            <h2>Направления</h2>
            <div className="tags">
              {info.specializations.map((s) => (
                <span key={s} className="tag tag--lg">
                  {s}
                </span>
              ))}
            </div>
          </section>
          <section className="card-section card-section--row">
            <div>
              <h2>Формат</h2>
              <ul className="plain-list">
                {data.formats.includes('online') && (
                  <li>
                    <VideoCameraIcon size={18} weight="bold" /> Онлайн — видеокомната Pingo
                  </li>
                )}
                {data.formats.includes('offline') && (
                  <li>
                    <MapPinIcon size={18} weight="bold" /> Очно — {data.city}
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h2>Языки</h2>
              <ul className="plain-list">
                <li>
                  <GlobeIcon size={18} weight="bold" /> {info.languages.join(', ')}
                </li>
              </ul>
            </div>
          </section>

          {certificates.length > 0 && (
            <section className="card-section">
              <h2>Награды Pingo</h2>
              <CertificateList items={certificates} />
            </section>
          )}

          <section className="card-section">
            <h2>
              Отзывы {entry.reviewsCount > 0 && <span className="muted">· {entry.reviewsCount}</span>}
            </h2>
            {entry.reviews.length === 0 ? (
              <p className="muted">Пока нет отзывов — станьте первым после занятия.</p>
            ) : (
              <ul className="reviews">
                {entry.reviews.map((r) => (
                  <li key={r.id} className="review">
                    <div className="review__head">
                      <strong>{r.authorName}</strong>
                      <Stars value={r.rating} size={14} />
                    </div>
                    {r.text && <p>{r.text}</p>}
                    <span className="review__meta">
                      {r.childAge ? `Ребёнку ${fmtAge(r.childAge)} · ` : ''}
                      {fmtShortDate(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="detail__side">
          <div className="book-box">
            <h3>Ближайшие окна</h3>
            {slots.length ? (
              <div className="slot-list">
                {slots.slice(0, 4).map((s) => (
                  <Link key={s.start} to={hasChildren ? `book?start=${s.start}` : '/parent/children/new'} className="slot-chip">
                    {fmtDayTime(s.start, now)}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">На ближайшие три недели свободных окон нет. Напишите специалисту — возможно, появится время.</p>
            )}
            {slots.length > 0 && bookAction}
            <Button variant="soft" size="lg" icon={ChatCircleDotsIcon} onClick={writeMessage} block>
              Задать вопрос
            </Button>
            <p className="book-box__note">Запись подтверждает специалист. Видеокомната откроется за 15 минут до начала.</p>
          </div>
        </aside>
      </div>

      {slots.length > 0 && <div className="sticky-cta">{bookAction}</div>}

      <ComplaintDialog
        open={complaintOpen}
        onClose={() => setComplaintOpen(false)}
        reporterId={user.id}
        target={sp}
        context={{ profileId: id }}
      />
    </div>
  );
}
