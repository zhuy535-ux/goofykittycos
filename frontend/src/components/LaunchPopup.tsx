import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import type { Invitation, TeamNote } from '../types';

interface Props { onJump: (path: string) => void; }

export default function LaunchPopup({ onJump }: Props) {
  const open = useUI((s) => s.showLaunchPopup);
  const close = () => useUI.getState().setShowLaunchPopup(false);
  const user = useAuth((s) => s.user)!;

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notes, setNotes] = useState<TeamNote[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get<Invitation[]>(`/invitations?user_id=${user.id}&status=pending`),
      api.get<TeamNote[]>(`/notes/team?user_id=${user.id}`).then((rows) =>
        rows.filter((n) => n.to_user_id === user.id && !n.read)
      ),
    ]).then(([inv, n]) => { setInvitations(inv); setNotes(n); });
  }, [open, user.id]);

  if (!open) return null;

  const respond = async (id: string, decision: 'accepted' | 'rejected') => {
    await api.post(`/invitations/${id}/respond`, { decision });
    setInvitations((rows) => rows.filter((r) => r.id !== id));
  };

  const ackNote = async (id: string) => {
    await api.post(`/notes/team/${id}/read`);
    setNotes((rows) => rows.filter((r) => r.id !== id));
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 520 }}>
        <h2>Welcome back</h2>
        <p className="meta" style={{ marginTop: 0 }}>
          Things waiting for you. Routine updates aren't shown here — find them in the Notifications sidebar.
        </p>

        {invitations.length === 0 && notes.length === 0 ? (
          <p className="list-empty">All clear. No pending invitations or peer notes.</p>
        ) : null}

        {invitations.length > 0 && (
          <>
            <h3 style={{ margin: '8px 0 4px' }}>Pending meeting invitations</h3>
            {invitations.map((inv) => (
              <div key={inv.id} className="card priority-1">
                <strong>{inv.event_title}</strong>
                <div className="meta">
                  from {inv.from_name || inv.from_email} · {new Date(inv.start_iso).toLocaleString()}
                </div>
                {inv.message && <div style={{ marginTop: 6 }}>{inv.message}</div>}
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button className="primary" onClick={() => respond(inv.id, 'accepted')}>Accept</button>
                  <button onClick={() => respond(inv.id, 'rejected')}>Reject</button>
                </div>
              </div>
            ))}
          </>
        )}

        {notes.length > 0 && (
          <>
            <h3 style={{ margin: '12px 0 4px' }}>Notes for you</h3>
            {notes.map((n) => (
              <div key={n.id} className="card priority-2">
                <div className="meta">from {n.from_name || n.from_email}</div>
                <div style={{ marginTop: 6 }}>{n.body}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button onClick={() => ackNote(n.id)}>Mark read</button>
                  <button onClick={() => { ackNote(n.id); onJump('/workspace/notes'); close(); }}>Open</button>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="row actions">
          <button className="primary" onClick={close}>Done</button>
        </div>
      </div>
    </div>
  );
}
