import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckIcon, TrayIcon, XIcon } from '@phosphor-icons/react';
import { DECLINE_TEMPLATES } from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBookingsFor } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { confirmBooking, declineBooking, displayStatus } from '../../services/bookings';
import { BookingCard } from '../../components/BookingCard';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { ReasonDialog } from '../../components/Sheet';
import { Button, ButtonLink, Stagger, Tabs } from '../../components/ui';

const EMPTY = {
  pending: { title: 'Новых запросов нет', text: 'Когда родитель выберет ваше время, запрос появится здесь, а я пришлю уведомление.' },
  upcoming: { title: 'Нет подтверждённых занятий', text: 'Примите запрос — и занятие появится в этом списке.' },
  history: { title: 'История пуста', text: 'Здесь будут проведённые, отклонённые и отменённые занятия.' },
};

export default function Requests() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow(30_000);
  const bookings = useBookingsFor(user);
  const [params, setParams] = useSearchParams();
  const [declineId, setDeclineId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const tab = params.get('tab') || 'pending';

  const groups = useMemo(() => {
    const list = bookings ?? [];
    const st = (b) => displayStatus(b, now);
    return {
      pending: list.filter((b) => st(b) === 'pending').sort((a, b) => a.start - b.start),
      upcoming: list.filter((b) => st(b) === 'confirmed').sort((a, b) => a.start - b.start),
      history: list.filter((b) => !['pending', 'confirmed'].includes(st(b))).sort((a, b) => b.start - a.start),
    };
  }, [bookings, now]);

  if (!bookings) return <div className="page page--loading" />;

  const accept = async (id) => {
    setBusyId(id);
    try {
      await confirmBooking(user.id, id);
      toast.success('Занятие подтверждено — родитель получил уведомление');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const list = groups[tab] ?? [];

  return (
    <div className="page">
      <PageHeader title="Запросы" subtitle="Подтверждайте запросы вовремя — семья ждёт ответа." />
      <Tabs
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        layoutId="requests-tabs"
        items={[
          { value: 'pending', label: 'Новые', count: groups.pending.length },
          { value: 'upcoming', label: 'Предстоящие', count: groups.upcoming.length },
          { value: 'history', label: 'История' },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={TrayIcon}
          title={EMPTY[tab].title}
          text={EMPTY[tab].text}
          action={
            tab === 'pending' && (
              <ButtonLink to="/specialist/availability" variant="primary">
                Проверить расписание
              </ButtonLink>
            )
          }
        />
      ) : (
        <Stagger key={tab} className="list">
          {list.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              viewer="specialist"
              counterpart={b.parent}
              child={b.child}
              now={now}
              to={`/specialist/requests/${b.id}`}
              actions={
                tab === 'pending' && (
                  <>
                    <Button size="sm" variant="primary" icon={CheckIcon} loading={busyId === b.id} onClick={() => accept(b.id)}>
                      Принять
                    </Button>
                    <Button size="sm" variant="soft" icon={XIcon} onClick={() => setDeclineId(b.id)}>
                      Отклонить
                    </Button>
                  </>
                )
              }
            />
          ))}
        </Stagger>
      )}
      <ReasonDialog
        open={!!declineId}
        onClose={() => setDeclineId(null)}
        title="Отклонить запрос"
        text="Родитель увидит причину и сможет выбрать другое время или специалиста."
        templates={DECLINE_TEMPLATES}
        confirmLabel="Отклонить"
        onConfirm={(reason) => declineBooking(user.id, declineId, reason).then(() => toast.info('Запрос отклонён'))}
      />
    </div>
  );
}
