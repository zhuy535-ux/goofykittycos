import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { CalendarEvent, User } from '../types';
import { useAuth } from '../store/auth';
import { toastError, toastSuccess } from '../store/toast';

export default function TopBar() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const org = useAuth((s) => s.organization);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const orgName = org?.name?.trim() || 'ENTJ';
  const brandInitial = orgName.slice(0, 1).toUpperCase();

  return (
    <div className="topbar">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
        <div className="logo" aria-hidden>{brandInitial}</div>
        <div className="name">
          <strong>{orgName} | Workspace</strong>
          <span>goofykittycos.com</span>
        </div>
      </Link>

      <div className="giant-nav">
        <NavLink to="/workspace/calendar" className={({ isActive }) => 'giant-btn' + (isActive ? ' active' : '')} title="Individual calendar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" />
          </svg>
          <span className="label">Individual</span>
        </NavLink>

        <NavLink to="/workspace/composite" className={({ isActive }) => 'giant-btn' + (isActive ? ' active' : '')} title="Composite (overlap) calendar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8.5" cy="9" r="3" />
            <circle cx="15.5" cy="9" r="3" />
            <path d="M2.5 19.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
            <path d="M14.5 19.5c0-3 2.7-5.5 6-5.5" />
          </svg>
          <span className="label">Composite</span>
        </NavLink>
      </div>

      <button className="icon-btn" title="Invite teammate" onClick={() => setInviteOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <div className="spacer" />

      <GlobalSearch />

      <div className="spacer" style={{ flex: '0 0 12px' }} />

      {user && (
        <div style={{ position: 'relative' }}>
          <button
            className="username-btn"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            title={user.email}
          >
            <span className="avatar">{(user.username || user.email).slice(0, 1).toUpperCase()}</span>
            <span className="uname">{user.username || user.email}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {menuOpen && (
            <div className="username-menu">
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--divider)' }}>
                <strong style={{ fontSize: 13 }}>{user.display_name || user.username}</strong>
                <div className="muted" style={{ fontSize: 11 }}>{user.email}</div>
                <div className="muted" style={{ fontSize: 11 }}>@{user.username} <span style={{ fontStyle: 'italic' }}>· permanent</span></div>
              </div>
              <button className="ghost menu-item" onMouseDown={() => navigate('/workspace/settings')}>Settings</button>
              <button className="ghost menu-item" onMouseDown={() => { useAuth.getState().logout(); navigate('/'); }}>Sign out</button>
            </div>
          )}
        </div>
      )}

      {inviteOpen && <InviteTeamMemberModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function GlobalSearch() {
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CalendarEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const rows = await api.get<CalendarEvent[]>(
          `/events/search?user_id=${user.id}&q=${encodeURIComponent(q.trim())}`
        );
        setResults(rows);
      } catch { setResults([]); }
    }, 120);
    return () => clearTimeout(t);
  }, [q, user.id]);

  const onPick = (ev: CalendarEvent) => {
    setOpen(false); setQ('');
    navigate(`/workspace/calendar?date=${encodeURIComponent(ev.start_iso)}`);
  };

  return (
    <div className="search-wrap">
      <span className="search-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search events…   ⌘K"
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((ev) => (
            <div key={ev.id} className="search-result" onMouseDown={() => onPick(ev)}>
              <strong>{ev.title}</strong>
              <span>
                {new Date(ev.start_iso).toLocaleString()} · {ev.category}
                {ev.location ? ` · ${ev.location}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && q && results.length === 0 && (
        <div className="search-results">
          <div className="search-result" style={{ cursor: 'default' }}>
            <span className="muted">No matches for "{q}"</span>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteTeamMemberModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post<{ user: User }>('/users/invite', { email, displayName: name });
      toastSuccess('Invitation sent', `${email} will receive an email shortly.`);
      onClose();
    } catch (e) {
      toastError('Could not send invite', (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Invite teammate</h2>
        <p className="muted" style={{ marginTop: 0 }}>They'll get an email with a link to join the workspace.</p>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@yourstartup.com" autoFocus />
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
