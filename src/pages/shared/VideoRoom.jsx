import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ChatCircleDotsIcon,
  InfoIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  PhoneDisconnectIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  XIcon,
} from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { LEARNING_STYLE_MAP, NEED_MAP, describeAccessibility } from '../../lib/constants';
import { ageFromBirthDate, cx, fmtAge, fmtCountdown, fmtDayTime, fmtTime, pad2 } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { useRoomConnection } from '../../hooks/useRoomConnection';
import { useThemeColor } from '../../hooks/useThemeColor';
import { roomState, roomWindow } from '../../services/bookings';
import { conversationIdFor } from '../../services/chat';
import { Avatar } from '../../components/Avatar';
import { ChatThread } from '../../components/Chat';
import { Pingo } from '../../components/Pingo';
import { Button, ButtonLink } from '../../components/ui';

function Gate({ title, text, children, mood = 'open', back }) {
  return (
    <div className="room room--gate">
      <Link to={back} className="room__back" aria-label="Назад">
        <ArrowLeftIcon size={22} weight="bold" />
      </Link>
      <motion.div className="room__gate" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Pingo size={120} mood={mood} />
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {children}
      </motion.div>
    </div>
  );
}

function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

export default function VideoRoom() {
  useThemeColor('#141414');
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useNow(1000);
  const b = useBooking(id);
  const [joined, setJoined] = useState(false);
  const [stream, setStream] = useState(null);
  const [acquiring, setAcquiring] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [panel, setPanel] = useState(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);

  const participant = !!b && (b.parentId === user.id || b.specialistId === user.id);
  const state = b ? roomState(b, now) : null;
  const isOpen = state === 'open' && participant;
  const conversation = useLiveQuery(
    () => (b ? db.conversations.get(conversationIdFor(b.parentId, b.specialistId)) : undefined),
    [b?.parentId, b?.specialistId],
  );

  // Камера и микрофон запрашиваются, только когда комната открыта.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    let acquired = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('Браузер не даёт доступ к камере. Откройте Pingo по https или на localhost.');
        return;
      }
      setAcquiring(true);
      try {
        acquired = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        try {
          acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMediaError('Камера недоступна — вы подключитесь только со звуком.');
        } catch {
          setMediaError('Нет доступа к камере и микрофону. Разрешите доступ в браузере — или подключитесь без них и общайтесь в чате.');
        }
      }
      if (cancelled) {
        acquired?.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(acquired);
      setAcquiring(false);
    })();
    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
      setStream(null);
      setAcquiring(false);
    };
  }, [isOpen]);

  const { remoteStream, state: conn, remoteMedia, announceMedia } = useRoomConnection(id, stream, joined && isOpen);

  // Видео-элементы перемонтируются (лобби → звонок, камера вкл/выкл, смена статуса связи),
  // поэтому поток назначаем заново при каждом таком изменении.
  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== stream) localRef.current.srcObject = stream;
  }, [stream, joined, cam]);
  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream, joined, remoteMedia.video, conn]);

  const back = user.role === 'parent' ? `/parent/bookings/${id}` : `/specialist/requests/${id}`;

  if (b === undefined) return <div className="room room--gate" />;
  if (!b || !participant) {
    return <Gate back={`/${user.role}`} title="Комната недоступна" text="Видеокомната открыта только для родителя и специалиста этой записи." mood="wink" />;
  }
  const other = user.id === b.parentId ? b.specialist : b.parent;
  const { opensAt } = roomWindow(b);

  if (state === 'offline') return <Gate back={back} title="Это очное занятие" text="Адрес и детали встречи обсудите в чате." />;
  if (state === 'unconfirmed') {
    return <Gate back={back} title="Ждём подтверждения" text="Видеокомната откроется только после того, как специалист подтвердит запись." />;
  }
  if (state === 'unavailable') return <Gate back={back} title="Запись неактивна" text="Занятие отменено или отклонено." mood="wink" />;
  if (state === 'ended') {
    return (
      <Gate back={back} title="Занятие завершено" text="Спасибо! Отчёт и отзыв — в карточке записи." mood="happy">
        <ButtonLink to={back} variant="primary">
          К записи
        </ButtonLink>
      </Gate>
    );
  }
  if (state === 'waiting') {
    return (
      <Gate back={back} title="Комната пока закрыта" text={`Она откроется за 15 минут до начала — ${fmtDayTime(opensAt, now).toLowerCase()}.`}>
        <div className="room__countdown">{fmtCountdown(opensAt - now)}</div>
        <p className="room__muted">Можно закрыть страницу — Pingo пришлёт напоминание.</p>
      </Gate>
    );
  }

  const leave = () => {
    setJoined(false);
    navigate(back);
  };
  const toggleMic = () => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = !mic));
    announceMedia({ audio: !mic, video: cam });
    setMic(!mic);
  };
  const toggleCam = () => {
    stream?.getVideoTracks().forEach((t) => (t.enabled = !cam));
    announceMedia({ audio: mic, video: !cam });
    setCam(!cam);
  };
  const hasVideo = !!stream?.getVideoTracks().length;
  const started = now >= b.start;
  const child = b.child;

  if (!joined) {
    return (
      <div className="room room--lobby">
        <Link to={back} className="room__back" aria-label="Назад">
          <ArrowLeftIcon size={22} weight="bold" />
        </Link>
        <div className="lobby">
          <div className="lobby__preview">
            {hasVideo && cam ? (
              <video ref={localRef} autoPlay playsInline muted className="mirror" />
            ) : (
              <div className="lobby__placeholder">
                <Avatar avatar={user.avatar} name={user.name} size={96} />
              </div>
            )}
            <div className="room__controls room__controls--lobby">
              <button type="button" className={cx('ctl', !mic && 'is-off')} onClick={toggleMic} disabled={!stream} aria-label={mic ? 'Выключить микрофон' : 'Включить микрофон'}>
                {mic ? <MicrophoneIcon size={24} weight="fill" /> : <MicrophoneSlashIcon size={24} weight="fill" />}
              </button>
              <button type="button" className={cx('ctl', !cam && 'is-off')} onClick={toggleCam} disabled={!hasVideo} aria-label={cam ? 'Выключить камеру' : 'Включить камеру'}>
                {cam ? <VideoCameraIcon size={24} weight="fill" /> : <VideoCameraSlashIcon size={24} weight="fill" />}
              </button>
            </div>
          </div>
          <div className="lobby__info">
            <span className="live-pill">
              <span className="live-dot" /> Комната открыта
            </span>
            <h1>Занятие · {user.id === b.parentId ? other?.name : child?.name}</h1>
            <p>
              {started ? 'Занятие уже идёт' : `Начало в ${fmtTime(b.start)} — через ${fmtCountdown(b.start - now)}`} · {b.duration} мин
            </p>
            {mediaError && <p className="lobby__error">{mediaError}</p>}
            <Button variant="primary" size="lg" onClick={() => setJoined(true)} loading={acquiring} block>
              Присоединиться
            </Button>
            <p className="room__muted">
              Видео идёт напрямую между вашими устройствами. Если связь не устанавливается, проверьте интернет или общайтесь в
              чате комнаты.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const remoteVisible = conn === 'connected' && remoteStream && remoteMedia.video;

  return (
    <div className={cx('room room--call', panel && 'has-panel')}>
      <header className="room__top">
        <button type="button" className="room__back room__back--inline" aria-label="Выйти" onClick={leave}>
          <ArrowLeftIcon size={22} weight="bold" />
        </button>
        <div className="room__title">
          <strong>{user.id === b.parentId ? other?.name : `${child?.name}, ${fmtAge(ageFromBirthDate(child?.birthDate))}`}</strong>
          <span>
            {started ? `${elapsed(now - b.start)} из ${b.duration}:00` : `Начало через ${fmtCountdown(b.start - now)}`}
          </span>
        </div>
        <span className={cx('conn', `conn--${conn}`)}>
          {conn === 'connected' ? 'На связи' : conn === 'connecting' ? 'Подключение…' : 'Ожидание'}
        </span>
      </header>

      <div className="room__stage">
        {remoteVisible ? (
          <video ref={remoteRef} autoPlay playsInline className="room__remote" />
        ) : (
          <div className="room__waiting">
            <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.2, repeat: Infinity }}>
              <Avatar avatar={other?.avatar} name={other?.name} size={120} />
            </motion.div>
            <p>
              {conn === 'connected'
                ? `${other?.name ?? 'Собеседник'} выключил(а) камеру`
                : conn === 'connecting'
                  ? 'Подключаемся…'
                  : `Ожидаем ${other?.name ?? 'собеседника'}…`}
            </p>
            {remoteStream && !remoteMedia.video && <audio ref={remoteRef} autoPlay />}
          </div>
        )}
        <motion.div className="room__self" drag dragMomentum={false} whileDrag={{ scale: 1.04 }}>
          {hasVideo && cam ? (
            <video ref={localRef} autoPlay playsInline muted className="mirror" />
          ) : (
            <Avatar avatar={user.avatar} name={user.name} size={56} />
          )}
          {!mic && <MicrophoneSlashIcon size={16} weight="fill" className="room__self-mic" />}
        </motion.div>
      </div>

      <div className="room__controls">
        <button type="button" className={cx('ctl', !mic && 'is-off')} onClick={toggleMic} disabled={!stream} aria-label={mic ? 'Выключить микрофон' : 'Включить микрофон'}>
          {mic ? <MicrophoneIcon size={24} weight="fill" /> : <MicrophoneSlashIcon size={24} weight="fill" />}
        </button>
        <button type="button" className={cx('ctl', !cam && 'is-off')} onClick={toggleCam} disabled={!hasVideo} aria-label={cam ? 'Выключить камеру' : 'Включить камеру'}>
          {cam ? <VideoCameraIcon size={24} weight="fill" /> : <VideoCameraSlashIcon size={24} weight="fill" />}
        </button>
        <button type="button" className={cx('ctl', panel === 'chat' && 'is-active')} onClick={() => setPanel(panel === 'chat' ? null : 'chat')} aria-label="Чат">
          <ChatCircleDotsIcon size={24} weight="fill" />
        </button>
        <button type="button" className={cx('ctl', panel === 'info' && 'is-active')} onClick={() => setPanel(panel === 'info' ? null : 'info')} aria-label="О занятии">
          <InfoIcon size={24} weight="fill" />
        </button>
        <button type="button" className="ctl ctl--leave" onClick={leave} aria-label="Завершить">
          <PhoneDisconnectIcon size={26} weight="fill" />
        </button>
      </div>

      <AnimatePresence>
        {panel && (
          <motion.aside
            className="room__panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            <div className="room__panel-head">
              <strong>{panel === 'chat' ? 'Чат' : 'О занятии'}</strong>
              <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label="Закрыть" onClick={() => setPanel(null)}>
                <XIcon size={18} weight="bold" />
              </button>
            </div>
            {panel === 'chat' ? (
              conversation ? (
                <ChatThread conversation={conversation} me={user.id} other={other} showHeader={false} className="chat--room" />
              ) : (
                <p className="room__muted">Чат недоступен.</p>
              )
            ) : (
              <div className="room__info">
                <div className="person-card">
                  <Avatar avatar={child?.avatar} name={child?.name} size={52} />
                  <div>
                    <strong>
                      {child?.name}, {fmtAge(ageFromBirthDate(child?.birthDate))}
                    </strong>
                    <span>Родитель: {b.parent?.name}</span>
                  </div>
                </div>
                {child?.needs?.length > 0 && (
                  <div className="tags">
                    {child.needs.map((n) => (
                      <span key={n} className="tag">
                        {NEED_MAP[n]?.label}
                      </span>
                    ))}
                  </div>
                )}
                <dl className="info-list">
                  {child?.learningStyles?.length > 0 && (
                    <>
                      <dt>Как учится</dt>
                      <dd>{child.learningStyles.map((s) => LEARNING_STYLE_MAP[s]?.label).join(', ')}</dd>
                    </>
                  )}
                  {describeAccessibility(child?.accessibility).length > 0 && (
                    <>
                      <dt>Комфортно</dt>
                      <dd>{describeAccessibility(child.accessibility).join(', ')}</dd>
                    </>
                  )}
                  {child?.goals && (
                    <>
                      <dt>Цели</dt>
                      <dd>{child.goals}</dd>
                    </>
                  )}
                  {child?.notes && (
                    <>
                      <dt>Важно знать</dt>
                      <dd>{child.notes}</dd>
                    </>
                  )}
                  {b.note && (
                    <>
                      <dt>Заметка к занятию</dt>
                      <dd>{b.note}</dd>
                    </>
                  )}
                </dl>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
