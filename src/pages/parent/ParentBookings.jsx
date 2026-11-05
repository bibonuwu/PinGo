import { useMemo, useState } from 'react';
import { CalendarDotsIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useBookingsFor, useChildren } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { isUpcoming } from '../../services/bookings';
import { BookingCard } from '../../components/BookingCard';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ButtonLink, Chip, Stagger, Tabs } from '../../components/ui';
import { t } from '../../i18n';

export default function ParentBookings() {
  const { user } = useAuth();
  const now = useNow(30_000);
  const bookings = useBookingsFor(user);
  const children = useChildren(user.id);
  const [tab, setTab] = useState('upcoming');
  const [childFilter, setChildFilter] = useState('all');

  const { upcoming, past } = useMemo(() => {
    const list = (bookings ?? []).filter((b) => childFilter === 'all' || b.childId === childFilter);
    return {
      upcoming: list.filter((b) => isUpcoming(b, now)).sort((a, b) => a.start - b.start),
      past: list.filter((b) => !isUpcoming(b, now)).sort((a, b) => b.start - a.start),
    };
  }, [bookings, childFilter, now]);

  if (!bookings || !children) return <div className="page page--loading" />;

  if (bookings.length === 0) {
    return (
      <div className="page">
        <PageHeader title={t('Записи')} />
        <EmptyState
          icon={CalendarDotsIcon}
          title={t('Ваше расписание пока свободно')}
          text={t('Запишитесь на занятие и следите за подтверждением здесь.')}
          steps={[t('Найдите специалиста в каталоге'), t('Выберите удобное время'), t('Следите за статусом здесь')]}
          action={
            <ButtonLink to="/parent/specialists" variant="primary" size="lg" icon={MagnifyingGlassIcon} block>
              {t('Найти специалиста')}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="page">
      <PageHeader title={t('Записи')} />
      <Tabs
        value={tab}
        onChange={setTab}
        layoutId="bookings-tabs"
        items={[
          { value: 'upcoming', label: t('Предстоящие'), count: upcoming.length },
          { value: 'past', label: t('Прошедшие') },
        ]}
      />
      {children.length > 1 && (
        <div className="chips chips--scroll chips--sm">
          <Chip active={childFilter === 'all'} onClick={() => setChildFilter('all')}>
            {t('Все дети')}
          </Chip>
          {children.map((c) => (
            <Chip key={c.id} active={childFilter === c.id} onClick={() => setChildFilter(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState
          icon={CalendarDotsIcon}
          title={tab === 'upcoming' ? t('Нет предстоящих занятий') : t('Здесь появится история занятий')}
          text={tab === 'upcoming' ? t('Выберите специалиста и время — запись появится здесь.') : t('Проведённые, отменённые и отклонённые записи.')}
          action={
            tab === 'upcoming' && (
              <ButtonLink to="/parent/specialists" variant="primary" icon={MagnifyingGlassIcon}>
                {t('Найти специалиста')}
              </ButtonLink>
            )
          }
        />
      ) : (
        <Stagger key={`${tab}-${childFilter}`} className="list">
          {list.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              viewer="parent"
              counterpart={b.specialist}
              child={b.child}
              now={now}
              to={`/parent/bookings/${b.id}`}
            />
          ))}
        </Stagger>
      )}
    </div>
  );
}
