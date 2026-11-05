import { useParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { ChatCircleDotsIcon, ChatsCircleIcon, MagnifyingGlassIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { cx } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { parseConversationId, supportAdminOf, supportDraft } from '../../services/chat';
import { ChatThread, ConversationList } from '../../components/Chat';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ButtonLink } from '../../components/ui';

// Модератор в диалоге поддержки стоит на месте специалиста (с родителем) или родителя (со специалистом),
// см. services/chat.js, поэтому его диалоги ищутся по обоим полям.
export default function Messages() {
  const { user } = useAuth();
  const { id } = useParams();
  const desktop = useIsDesktop();
  const isParent = user.role === 'parent';
  const isAdmin = user.role === 'admin';
  const base = `/${user.role}/messages`;

  const conversations = useLiveQuery(async () => {
    const fields = isAdmin ? ['parentId', 'specialistId'] : [isParent ? 'parentId' : 'specialistId'];
    const lists = await Promise.all(fields.map((f) => db.conversations.where(f).equals(user.id).toArray()));
    const list = lists.flat();
    const others = await db.users.bulkGet(list.map((c) => (c.parentId === user.id ? c.specialistId : c.parentId)));
    return list.map((c, i) => ({ ...c, other: others[i] })).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [user.id, isParent, isAdmin]);

  // Модератор открыл чат с тем, кому ещё не писал: диалог-черновик появится в базе с первым сообщением.
  const draftPerson = useLiveQuery(async () => {
    const ids = isAdmin ? parseConversationId(id) : null;
    if (!ids || (ids.parentId !== user.id && ids.specialistId !== user.id)) return null;
    const person = await db.users.get(ids.parentId === user.id ? ids.specialistId : ids.parentId);
    return person && person.role !== 'admin' ? person : null;
  }, [id, isAdmin, user.id]);

  // Модератору в чате со специалистом — ссылка на анкету, если она уже отправлена (черновик не открывается).
  const profileOpenable = useLiveQuery(async () => {
    const ids = isAdmin ? parseConversationId(id) : null;
    if (!ids) return false;
    const p = await db.profiles.get(ids.parentId === user.id ? ids.specialistId : ids.parentId);
    return Boolean(p && p.status !== 'draft');
  }, [id, isAdmin, user.id]);

  const saved = id ? conversations?.find((c) => c.id === id) : null;
  if (!conversations || (isAdmin && id && !saved && draftPerson === undefined)) return <div className="page page--loading" />;

  // id черновика зависит от роли собеседника — так неподходящая пара (например, модератор на чужом месте) не откроется.
  const draft = draftPerson && supportDraft(user.id, draftPerson);
  const active = saved ?? (draft?.id === id ? { ...draft, other: draftPerson } : null);

  if (!conversations.length && !active) {
    return (
      <div className="page">
        <PageHeader title="Сообщения" />
        {isAdmin ? (
          <EmptyState
            icon={ChatsCircleIcon}
            title="Пока нет диалогов"
            text="Чтобы написать родителю, специалисту или волонтёру, откройте «Пользователи» и нажмите на значок чата рядом с ним."
            action={
              <ButtonLink to="/admin/users" variant="primary" size="lg" icon={UsersThreeIcon} block>
                Пользователи
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={ChatsCircleIcon}
            title="Пока нет сообщений"
            text={
              isParent
                ? 'Диалог появится, когда вы запишетесь на занятие или зададите вопрос специалисту.'
                : 'Диалог появится, когда родитель запишется к вам или задаст вопрос.'
            }
            bullets={
              isParent
                ? ['Запишитесь на занятие, чтобы начать диалог', 'Специалист ответит о времени и деталях', 'Вся переписка — в одном месте']
                : ['Заполните анкету и расписание', 'Отвечайте родителям о целях и деталях', 'Вся переписка — в одном месте']
            }
            action={
              isParent ? (
                <ButtonLink to="/parent/specialists" variant="primary" size="lg" icon={MagnifyingGlassIcon} block>
                  Найти специалиста
                </ButtonLink>
              ) : (
                <ButtonLink to="/specialist/profile" variant="primary" size="lg" block>
                  Моя анкета
                </ButtonLink>
              )
            }
          />
        )}
      </div>
    );
  }

  const support = Boolean(supportAdminOf(active));
  const profileLink = !active
    ? undefined
    : isAdmin
      ? profileOpenable && active.other?.role === 'specialist' && `/admin/profiles/${active.other.id}`
      : isParent && !support && `/parent/specialists/${active.specialistId}`;
  const thread = active && (
    <ChatThread
      key={active.id}
      conversation={active}
      me={user.id}
      other={active.other}
      backTo={desktop ? undefined : base}
      profileLink={profileLink || undefined}
      bookingsLink={support ? undefined : isParent ? '/parent/bookings' : '/specialist/requests'}
    />
  );
  // Черновик показываем первым в списке, пока он открыт, — как будто диалог уже есть.
  const items = active && !saved ? [active, ...conversations] : conversations;

  if (!desktop && id) {
    return (
      <div className="chat-screen">
        {thread ?? (
          <EmptyState icon={ChatCircleDotsIcon} title="Диалог не найден" action={<ButtonLink to={base}>Все сообщения</ButtonLink>} />
        )}
      </div>
    );
  }

  return (
    <div className={cx('page messages', desktop && 'messages--split')}>
      <div className="messages__list">
        <PageHeader title="Сообщения" />
        <ConversationList items={items} me={user.id} basePath={base} activeId={id} />
      </div>
      {desktop && (
        <div className="messages__pane">
          {thread ?? (
            <div className="messages__placeholder">
              <ChatsCircleIcon size={56} weight="fill" />
              <p>{id ? 'Диалог не найден' : 'Выберите диалог слева'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
