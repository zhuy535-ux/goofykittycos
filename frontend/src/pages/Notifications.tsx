import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { api } from '../api/client';
import type { Notification } from '../types';

export default function Notifications() {
  const user = useAuth((s) => s.user)!;
  const setBadge = useUI((s) => s.setNotificationBadge);
  const [items, setItems] = useState<Notification[]>([]);

  const load = async () => {
    const rows = await api.get<Notification[]>(`/notifications?user_id=${user.id}`);
    setItems(rows);
    setBadge(rows.filter((r) => !r.read).length);
  };
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.post('/notifications/mark-read', { user_id: user.id });
    load();
  };

  return (
    <>
      <h2>Notifications</h2>
      <div className="cal-toolbar">
        <span className="meta">{items.filter((i) => !i.read).length} unread</span>
        <div className="grow" />
        <button onClick={markAll}>Mark all read</button>
      </div>
      {items.length === 0 && <p className="list-empty">Nothing here yet.</p>}
      {items.map((n) => (
        <div key={n.id} className="card" style={{ opacity: n.read ? 0.65 : 1 }}>
          <strong>{labelFor(n)}</strong>
          <div className="meta">{new Date(n.created_at).toLocaleString()}</div>
          <pre style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(n.payload, null, 2)}
          </pre>
        </div>
      ))}
    </>
  );
}

function labelFor(n: Notification): string {
  if (n.kind === 'invitation') return '📨 Meeting invitation';
  if (n.kind === 'peer_note') return '💬 Note from a teammate';
  return '🔔 ' + ((n.payload as any).kind || 'Update');
}
