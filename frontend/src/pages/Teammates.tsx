import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { useSocket } from '../store/socket';
import { api } from '../api/client';
import type { Organization, User } from '../types';
import { toastError, toastSuccess } from '../store/toast';

/**
 * Combines two concerns the v3 spec asked us to consolidate:
 *   1. Admin "Team Management" — invitation code (copy + regenerate), email-invite.
 *   2. Roster — list teammates with online dot, remove for admins.
 *
 * Members see a read-only invitation code (hidden by backend) and no Remove buttons.
 */
export default function Teammates() {
  const me = useAuth((s) => s.user)!;
  const org = useAuth((s) => s.organization);
  const setOrganization = useAuth((s) => s.setOrganization);
  const online = useSocket((s) => s.online);
  const [users, setUsers] = useState<User[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isAdmin = me.role === 'admin';

  const load = () => api.get<User[]>('/users').then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const remove = async (u: User) => {
    if (u.id === me.id) return;
    if (!confirm(`Remove ${u.display_name || u.username || u.email} from ${org?.name}?\n\nThis deletes their events, notes, todos and bookmarks. This cannot be undone.`)) return;
    try {
      await api.del(`/users/${u.id}`);
      toastSuccess('Teammate removed', u.display_name || u.username || u.email);
      load();
    } catch (e) {
      toastError('Could not remove teammate', (e as Error).message);
    }
  };

  const copyCode = async () => {
    if (!org?.invitation_code) return;
    try {
      await navigator.clipboard.writeText(org.invitation_code);
      toastSuccess('Code copied', org.invitation_code);
    } catch {
      toastError('Copy failed', 'Select and copy manually.');
    }
  };

  const regenerate = async () => {
    if (!confirm('Regenerate the invitation code?\n\nAnyone who hasn\'t signed up yet will need the new code. Existing teammates are unaffected.')) return;
    try {
      const { invitation_code } = await api.post<{ invitation_code: string }>('/organizations/regenerate-code');
      if (org) setOrganization({ ...org, invitation_code } as Organization);
      toastSuccess('New invitation code', invitation_code);
    } catch (e) {
      toastError('Could not regenerate code', (e as Error).message);
    }
  };

  return (
    <>
      <h2>Team management</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {isAdmin
          ? 'Your invitation code is how new teammates join the workspace.'
          : `Roster for ${org?.name || 'this workspace'}.`}
      </p>

      {isAdmin && org && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Invitation code
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 22, fontWeight: 700, letterSpacing: '0.04em',
                color: 'var(--text-1)', marginTop: 2,
              }}
            >
              {org.invitation_code || '— hidden —'}
            </div>
          </div>
          <button onClick={copyCode}>Copy code</button>
          <button className="danger" onClick={regenerate}>Regenerate</button>
        </div>
      )}

      <div className="cal-toolbar">
        <span className="muted" style={{ fontSize: 12 }}>
          {users.length} member{users.length === 1 ? '' : 's'} · {online.length} online
        </span>
        <div className="grow" />
        {isAdmin && <button className="primary" onClick={() => setInviteOpen(true)}>+ Invite teammate by email</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {users.map((u, i) => {
          const isMe = u.id === me.id;
          const isOnline = online.includes(u.id);
          return (
            <div
              key={u.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderBottom: i === users.length - 1 ? '0' : '1px solid var(--divider)',
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: 999,
                  background: '#111', color: '#fff',
                  display: 'grid', placeItems: 'center',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                {(u.display_name || u.username || u.email).slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <strong>
                  {u.display_name || u.username}
                  {isMe && <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>(you)</span>}
                  {u.role === 'admin' && <span className="chip" style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px' }}>admin</span>}
                </strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                  @{u.username} · {u.email} · {u.timezone}
                </div>
              </div>
              {isAdmin && !isMe && <button className="danger" onClick={() => remove(u)}>Remove</button>}
            </div>
          );
        })}
      </div>

      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} onSaved={() => { setInviteOpen(false); load(); }} />
      )}
    </>
  );
}

function InviteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/users/invite', { email, displayName: name });
      toastSuccess('Invitation sent', `${email} will receive an email shortly.`);
      onSaved();
    } catch (e) {
      toastError('Invite failed', (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Invite by email</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          They'll get an email link. For self-service joining, share your invitation code from the card above.
        </p>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mom@home.com" autoFocus />
        <label>Display name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !email} onClick={submit}>{busy ? 'Sending…' : 'Send invite'}</button>
        </div>
      </div>
    </div>
  );
}
