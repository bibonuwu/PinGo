import { useEffect, useRef, useState } from 'react';
import { uid } from '../lib/utils';

// Видеосвязь между двумя участниками через WebRTC.
// Пока у Pingo нет сервера, сигналинг идёт через BroadcastChannel — звонок работает между
// вкладками одного браузера (например, родитель и специалист в соседних вкладках).
// Для реальных звонков достаточно заменить канал на WebSocket-сервер с тем же протоколом.
export function useRoomConnection(roomId, localStream, active) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [state, setState] = useState('waiting'); // waiting | connecting | connected
  const [remoteMedia, setRemoteMedia] = useState({ audio: true, video: true });
  const sendRef = useRef(() => {});

  useEffect(() => {
    if (!active || typeof BroadcastChannel === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      return undefined;
    }
    const me = uid();
    const channel = new BroadcastChannel(`pingo-room-${roomId}`);
    let pc = null;
    let peerId = null;
    let pendingIce = [];
    let closed = false;

    const send = (msg) => {
      if (!closed) channel.postMessage({ ...msg, from: me });
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
      const conn = new RTCPeerConnection({ iceServers: [] });
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

    channel.onmessage = async ({ data: m }) => {
      if (!m || m.from === me || (m.to && m.to !== me)) return;
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

    const onLeave = () => send({ type: 'bye' });
    window.addEventListener('pagehide', onLeave);
    send({ type: 'hello' });

    return () => {
      send({ type: 'bye' });
      closed = true;
      window.removeEventListener('pagehide', onLeave);
      reset();
      channel.close();
      sendRef.current = () => {};
    };
  }, [roomId, localStream, active]);

  const announceMedia = (media) => sendRef.current({ type: 'media', ...media });

  return { remoteStream, state, remoteMedia, announceMedia };
}
