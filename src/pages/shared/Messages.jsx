import { useParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { ChatCircleDotsIcon, ChatsCircleIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { cx } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { ChatThread, ConversationList } from '../../components/Chat';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ButtonLink } from '../../components/ui';

export default function Messages() {
  const { user } = useAuth();
  const { id } = useParams();
  const desktop = useIsDesktop();
  const isParent = user.role === 'parent';
  const base = `/${user.role}/messages`;

  const conversations = useLiveQuery(async () => {
    const list = await db.conversations.where(isParent ? 'parentId' : 'specialistId').equals(user.id).toArray();
    const others = await db.users.bulkGet(list.map((c) => (isParent ? c.specialistId : c.parentId)));
    return list.map((c, i) => ({ ...c, other: others[i] })).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [user.id, isParent]);

  if (!conversations) return <div className="page page--loading" />;

  if (!conversations.length) {
    return (
      <div className="page">
        <PageHeader title="Сообщения" />
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
      </div>
    );
  }

  const active = id ? conversations.find((c) => c.id === id) : null;
  const thread = active && (
    <ChatThread
      key={active.id}
      conversation={active}
      me={user.id}
      other={active.other}
      backTo={desktop ? undefined : base}
      profileLink={isParent ? `/parent/specialists/${active.specialistId}` : undefined}
      bookingsLink={isParent ? '/parent/bookings' : '/specialist/requests'}
    />
  );

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
        <ConversationList items={conversations} me={user.id} basePath={base} activeId={id} />
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
