import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRingingIcon,
  CloudCheckIcon,
  DownloadSimpleIcon,
  HandWavingIcon,
  SignOutIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { APP_VERSION, SLOGAN, suggestAccessibility } from '../../lib/constants';
import { notificationPermission, requestNotificationPermission, showSystemNotification } from '../../lib/systemNotify';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useChildren } from '../../hooks/useBookings';
import { updateUser } from '../../services/auth';
import { updateChildAccessibility } from '../../services/children';
import { deleteAccount, exportData } from '../../services/data';
import { AccessibilityForm } from '../../components/AccessibilityForm';
import { InstallCard } from '../../components/InstallCard';
import { PageHeader } from '../../components/PageHeader';
import { Pingo } from '../../components/Pingo';
import { ConfirmDialog } from '../../components/Sheet';
import { Button, ButtonLink, Segmented } from '../../components/ui';

const PERMISSION_TEXT = {
  granted: 'Разрешены — Pingo пришлёт уведомление, даже если вкладка свёрнута.',
  denied: 'Запрещены в браузере. Разрешите их в настройках сайта (значок замка в адресной строке).',
  default: 'Включите, чтобы узнавать о подтверждении записей и открытии видеокомнаты.',
  unsupported: 'Этот браузер не поддерживает уведомления.',
};

export default function Settings() {
  const { user, signOut, setLeaving } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const children = useChildren(user.role === 'parent' ? user.id : null);
  const [childId, setChildId] = useState(null);
  const [perm, setPerm] = useState(notificationPermission);
  const [dialog, setDialog] = useState(null);

  const isParent = user.role === 'parent';
  const a11yChild = isParent ? children?.find((c) => c.id === (childId ?? user.activeChildId)) ?? children?.[0] : null;

  const enableNotifications = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === 'granted') {
      toast.success('Уведомления включены');
      showSystemNotification('Pingo на связи 🐧', { body: 'Так будут выглядеть уведомления о записях и занятиях.', tag: 'pingo-test' });
    }
  };

  const logout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="page settings">
      <PageHeader back={`/${user.role}${user.role === 'admin' ? '' : '/profile'}`} title="Настройки" />

      <section className="settings__section">
        <h2 className="section-label">
          <span>Приложение</span>
        </h2>
        <InstallCard />
        <div className="card-section setting-row">
          <BellRingingIcon size={26} weight="fill" className="ico-yellow" />
          <div>
            <strong>Уведомления на устройстве</strong>
            <span>{PERMISSION_TEXT[perm] ?? PERMISSION_TEXT.default}</span>
          </div>
          {perm === 'default' && (
            <Button size="sm" variant="dark" onClick={enableNotifications}>
              Включить
            </Button>
          )}
        </div>
      </section>

      {user.role !== 'admin' && (
        <section className="settings__section">
          <h2 className="section-label">
            <span>Доступность</span>
          </h2>
          <div className="card-section">
            {isParent ? (
              children?.length ? (
                <>
                  <p className="muted small">
                    Настройки свои для каждого ребёнка и применяются ко всему приложению, когда ребёнок выбран в «Кто занимается
                    сегодня?».
                  </p>
                  {children.length > 1 && (
                    <Segmented
                      value={a11yChild.id}
                      onChange={setChildId}
                      options={children.map((c) => ({ id: c.id, label: c.name }))}
                      layoutId="a11y-child"
                    />
                  )}
                  <AccessibilityForm
                    key={a11yChild.id}
                    idPrefix={`settings-${a11yChild.id}`}
                    value={a11yChild.accessibility}
                    suggestion={suggestAccessibility(a11yChild.needs)}
                    suggestionFor={a11yChild.name}
                    onChange={(a) => updateChildAccessibility(a11yChild.id, a)}
                  />
                </>
              ) : (
                <div className="setting-row">
                  <div>
                    <strong>Сначала добавьте ребёнка</strong>
                    <span>Настройки доступности задаются для каждого ребёнка отдельно.</span>
                  </div>
                  <ButtonLink to="/parent/children/new" size="sm" variant="dark">
                    Добавить
                  </ButtonLink>
                </div>
              )
            ) : (
              <AccessibilityForm idPrefix="settings-me" value={user.accessibility} onChange={(a) => updateUser(user.id, { accessibility: a })} />
            )}
          </div>
        </section>
      )}

      {user.role !== 'admin' && (
        <section className="settings__section">
          <h2 className="section-label">
            <span>Pingo-гид</span>
          </h2>
          <div className="card-section setting-row">
            <HandWavingIcon size={26} weight="fill" className="ico-yellow" />
            <div>
              <strong>Знакомство с приложением</strong>
              <span>Пингвин ещё раз покажет, что где находится.</span>
            </div>
            <Button
              size="sm"
              variant="soft"
              onClick={async () => {
                await updateUser(user.id, { tourDone: false });
                navigate(`/${user.role}`);
              }}
            >
              Показать
            </Button>
          </div>
        </section>
      )}

      <section className="settings__section">
        <h2 className="section-label">
          <span>Данные</span>
        </h2>
        <div className="card-section">
          <div className="setting-row">
            <CloudCheckIcon size={26} weight="fill" className="ico-yellow" />
            <div>
              <strong>Данные в облаке Pingo</strong>
              <span>
                Аккаунт, профили детей, записи и сообщения хранятся на защищённом сервере и доступны с любого устройства. Видят
                их только участники записи и модератор.
              </span>
            </div>
          </div>
          <div className="btn-row">
            <Button variant="soft" icon={DownloadSimpleIcon} onClick={() => exportData().then(() => toast.success('Файл с данными сохранён'))}>
              Экспорт в JSON
            </Button>
            {user.role !== 'admin' && (
              <Button variant="danger-ghost" icon={TrashIcon} onClick={() => setDialog('delete')}>
                Удалить аккаунт
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="settings__section">
        <div className="card-section about">
          <Pingo size={72} mood="happy" />
          <div>
            <strong>Pingo · {SLOGAN}</strong>
            <span>
              Версия {APP_VERSION}. Платформа, где родители находят волонтёров и специалистов для занятий с детьми с особыми
              потребностями.
            </span>
          </div>
        </div>
        <Button variant="danger-ghost" size="lg" icon={SignOutIcon} block onClick={logout}>
          Выйти из аккаунта
        </Button>
      </section>

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Удалить аккаунт?"
        text={
          isParent
            ? 'Будут удалены аккаунт, профили детей и уведомления. Прошедшие записи и переписка останутся у специалистов. Это действие нельзя отменить.'
            : 'Будут удалены аккаунт, анкета, расписание, документы и уведомления — вы пропадёте из каталога. Прошедшие записи и переписка останутся у родителей. Это действие нельзя отменить.'
        }
        confirmLabel="Удалить аккаунт"
        tone="danger"
        onConfirm={async () => {
          try {
            // Проверки пройдены — дальше удаление: сразу уходим из кабинета.
            await deleteAccount(user, () => setLeaving(true));
          } catch (e) {
            setLeaving(false);
            throw e;
          }
          toast.success('Аккаунт удалён');
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}
