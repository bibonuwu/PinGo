import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, firestore } from '../lib/firebase';
import { uid } from '../lib/utils';

// Публичные STUN-серверы помогают пройти NAT. В сетях со строгим NAT (часть мобильных операторов,
// корпоративные сети) для звонка понадобится ещё TURN-сервер — его добавляют сюда же.
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

// Видеосвязь между двумя участниками через WebRTC.
// Сигналинг идёт через Firestore: каждое сообщение (hello / offer / answer / ice / media / bye) —
// документ в rooms/{bookingId}/signals. Читать и писать их могут только родитель и специалист записи.
export function useRoomConnection(roomId, localStream, active) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [state, setState] = useState('waiting'); // waiting | connecting | connected
  const [remoteMedia, setRemoteMedia] = useState({ audio: true, video: true });
  const sendRef = useRef(() => {});

  useEffect(() => {
    if (!active || typeof RTCPeerConnection === 'undefined') {
      return undefined;
    }
    const me = uid();
    const owner = auth.currentUser?.uid;
    const signals = collection(firestore, 'rooms', roomId, 'signals');
    const mine = [];
    let seq = 0;
    let pc = null;
    let peerId = null;
    let pendingIce = [];
    let closed = false;

    const send = (msg) => {
      if (closed) return;
      addDoc(signals, { ...msg, from: me, uid: owner, seq: (seq += 1), createdAt: Date.now() })
        .then((r) => mine.push(r))
        .catch((e) => console.warn('[room] signal', e));
    };
    sendRef.current = send;

    const reset = () => {
      if (pc) {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      pc = null;
      peerId = null;
      pendingIce = [];
      setRemoteStream(null);
      setState('waiting');
    };

    const addLocalTracks = (conn) => {
      const tracks = localStream ? localStream.getTracks() : [];
      for (const kind of ['audio', 'video']) {
        const track = tracks.find((t) => t.kind === kind);
        if (track) conn.addTrack(track, localStream);
        else if (!conn.getTransceivers().some((t) => t.receiver.track?.kind === kind)) {
          conn.addTransceiver(kind, { direction: 'recvonly' });
        }
      }
    };

    const createPc = (other) => {
      peerId = other;
      const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      conn.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
      conn.onicecandidate = (e) => {
        if (e.candidate) send({ type: 'ice', to: other, candidate: e.candidate.toJSON() });
      };
      conn.onconnectionstatechange = () => {
        if (conn !== pc) return;
        if (conn.connectionState === 'connected') setState('connected');
        if (conn.connectionState === 'failed' || conn.connectionState === 'closed') {
          reset();
          send({ type: 'hello' });
        }
      };
      pc = conn;
      setState('connecting');
      return conn;
    };

    const flushIce = async (conn) => {
      const list = pendingIce;
      pendingIce = [];
      for (const c of list) await conn.addIceCandidate(c).catch(() => {});
    };

    const handle = async (m) => {
      if (closed || !m || m.from === me || (m.to && m.to !== me)) return;
      try {
        if (m.type === 'hello') {
          if (pc && peerId !== m.from) return; // в комнате уже двое
          if (!m.reply) send({ type: 'hello', reply: true, to: m.from });
          // Оффер создаёт участник с «большим» id — так ровно один из двоих начинает соединение.
          if (!pc && me > m.from) {
            const conn = createPc(m.from);
            addLocalTracks(conn);
            await conn.setLocalDescription(await conn.createOffer());
            send({ type: 'offer', to: m.from, sdp: conn.localDescription.toJSON() });
          }
        } else if (m.type === 'offer') {
          if (pc && peerId !== m.from) return;
          if (pc) reset();
          const conn = createPc(m.from);
          await conn.setRemoteDescription(m.sdp);
          addLocalTracks(conn);
          await conn.setLocalDescription(await conn.createAnswer());
          send({ type: 'answer', to: m.from, sdp: conn.localDescription.toJSON() });
          await flushIce(conn);
        } else if (m.type === 'answer') {
          if (!pc || peerId !== m.from) return;
          await pc.setRemoteDescription(m.sdp);
          await flushIce(pc);
        } else if (m.type === 'ice') {
          if (!pc || peerId !== m.from) return;
          if (pc.remoteDescription) await pc.addIceCandidate(m.candidate).catch(() => {});
          else pendingIce.push(m.candidate);
        } else if (m.type === 'media') {
          if (peerId === m.from) setRemoteMedia({ audio: m.audio, video: m.video });
        } else if (m.type === 'bye') {
          if (peerId === m.from) {
            reset();
            setRemoteMedia({ audio: true, video: true });
          }
        }
      } catch {
        reset();
      }
    };

    // Сообщения, которые уже лежали в комнате до входа (прошлые подключения), пропускаем,
    // свои старые — удаляем. Остальные обрабатываем строго по порядку отправки.
    const seen = new Set();
    let synced = false;
    let queue = Promise.resolve();
    const stop = onSnapshot(
      signals,
      { includeMetadataChanges: true },
      (snap) => {
        if (!synced) {
          for (const d of snap.docs) seen.add(d.id);
          if (snap.metadata.fromCache) return;
          synced = true;
          for (const d of snap.docs) if (d.data().uid === owner) deleteDoc(d.ref).catch(() => {});
          send({ type: 'hello' });
          return;
        }
        const fresh = [];
        for (const change of snap.docChanges()) {
          if (change.type !== 'added' || seen.has(change.doc.id)) continue;
          seen.add(change.doc.id);
          fresh.push(change.doc.data());
        }
        fresh.sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq);
        for (const m of fresh) queue = queue.then(() => handle(m));
      },
      (e) => console.warn('[room] signals', e),
    );

    const onLeave = () => send({ type: 'bye' });
    window.addEventListener('pagehide', onLeave);

    return () => {
      send({ type: 'bye' });
      closed = true;
      stop();
      window.removeEventListener('pagehide', onLeave);
      reset();
      for (const r of mine) deleteDoc(r).catch(() => {});
      sendRef.current = () => {};
    };
  }, [roomId, localStream, active]);

  const announceMedia = (media) => sendRef.current({ type: 'media', ...media });

  return { remoteStream, state, remoteMedia, announceMedia };
}
