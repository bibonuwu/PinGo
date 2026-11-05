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
import { t } from '../../i18n';

const EMPTY = {
  pending: { title: t('Новых запросов нет'), text: t('Когда родитель выберет ваше время, запрос появится здесь, а я пришлю уведомление.') },
  upcoming: { title: t('Нет подтверждённых занятий'), text: t('Примите запрос — и занятие появится в этом списке.') },
  history: { title: t('История пуста'), text: t('Здесь будут проведённые, отклонённые и отменённые занятия.') },
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
      toast.success(t('Занятие подтверждено — родитель получил уведомление'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const list = groups[tab] ?? [];

  return (
    <div className="page">
      <PageHeader title={t('Запросы')} subtitle={t('Подтверждайте запросы вовремя — семья ждёт ответа.')} />
      <Tabs
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        layoutId="requests-tabs"
        items={[
          { value: 'pending', label: t('Новые'), count: groups.pending.length },
          { value: 'upcoming', label: t('Предстоящие'), count: groups.upcoming.length },
          { value: 'history', label: t('История') },
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
                {t('Проверить расписание')}
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
                      {t('Принять')}
                    </Button>
                    <Button size="sm" variant="soft" icon={XIcon} onClick={() => setDeclineId(b.id)}>
                      {t('Отклонить')}
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
        title={t('Отклонить запрос')}
        text={t('Родитель увидит причину и сможет выбрать другое время или специалиста.')}
        templates={DECLINE_TEMPLATES}
        confirmLabel={t('Отклонить')}
        onConfirm={(reason) => declineBooking(user.id, declineId, reason).then(() => toast.info(t('Запрос отклонён')))}
      />
    </div>
  );
}
