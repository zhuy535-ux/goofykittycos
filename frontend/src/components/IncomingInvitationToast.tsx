import { useEffect, useState } from 'react';
import { useSocket } from '../store/socket';
import { api } from '../api/client';
import type { Invitation } from '../types';
import { useUI } from '../store/ui';

export default function IncomingInvitationToast() {
  const socket = useSocket((s) => s.socket);
  const [queue, setQueue] = useState<Invitation[]>([]);
  const bump = useUI((s) => s.setNotificationBadge);
  const current = queue[0];

  useEffect(() => {
    if (!socket) return;
    const onInv = (inv: Invitation) => {
      setQueue((q) => [...q, inv]);
      bump((useUI.getState().notificationBadge ?? 0) + 1);
    };
    const onResp = () => {
      // Sender side gets a badge bump but no popup (Priority 3: regular).
      bump((useUI.getState().notificationBadge ?? 0) + 1);
    };
    socket.on('invitation:incoming', onInv);
    socket.on('invitation:responded', onResp);
    return () => {
      socket.off('invitation:incoming', onInv);
      socket.off('invitation:responded', onResp);
    };
  }, [socket, bump]);

  if (!current) return null;

  const respond = async (decision: 'accepted' | 'rejected') => {
    await api.post(`/invitations/${current.id}/respond`, { decision });
    setQueue((q) => q.slice(1));
  };

  return (
    <div
      style={{
        position: 'fixed', right: 16, bottom: 16, width: 360,
        zIndex: 50,
      }}
    >
      <div className="card priority-1" style={{ marginBottom: 0 }}>
        <strong>📥 New invitation</strong>
        <div className="meta">
          from {current.from_name || current.from_email} · {new Date(current.start_iso).toLocaleString()}
        </div>
        <div style={{ marginTop: 4 }}>{current.event_title}</div>
        {current.message && <div className="meta" style={{ marginTop: 4 }}>{current.message}</div>}
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button className="primary" onClick={() => respond('accepted')}>Accept</button>
          <button onClick={() => respond('rejected')}>Reject</button>
        </div>
      </div>
    </div>
  );
}
