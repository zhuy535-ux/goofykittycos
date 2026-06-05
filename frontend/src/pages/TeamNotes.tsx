import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { api } from '../api/client';
import type { Bookmark, TeamNote, User, CalendarEvent } from '../types';

export default function TeamNotes() {
  const user = useAuth((s) => s.user)!;

  const [tab, setTab] = useState<'notes' | 'bookmarks'>('notes');

  return (
    <>
      <h2>Team Notes & Bookmarks</h2>
      <div className="tabs">
        <div className={'tab' + (tab === 'notes' ? ' active' : '')} onClick={() => setTab('notes')}>Notes for others</div>
        <div className={'tab' + (tab === 'bookmarks' ? ' active' : '')} onClick={() => setTab('bookmarks')}>Bookmarks</div>
      </div>
      {tab === 'notes' ? <NotesPanel meId={user.id} /> : <BookmarksPanel meId={user.id} />}
    </>
  );
}

function NotesPanel({ meId }: { meId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [toId, setToId] = useState('');
  const [body, setBody] = useState('');
  const [items, setItems] = useState<TeamNote[]>([]);

  const load = async () => setItems(await api.get<TeamNote[]>(`/notes/team?user_id=${meId}`));
  useEffect(() => {
    load();
    api.get<User[]>('/users').then((rows) => setUsers(rows.filter((u) => u.id !== meId)));
  }, [meId]);

  const send = async () => {
    if (!toId || !body.trim()) return;
    await api.post('/notes/team', { from_user_id: meId, to_user_id: toId, body: body.trim() });
    setBody('');
    load();
  };

  return (
    <>
      <div className="card">
        <strong>Leave a note for a teammate</strong>
        <div className="row" style={{ marginTop: 8 }}>
          <div>
            <label>To</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">— pick teammate —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.email}</option>)}
            </select>
          </div>
          <div>
            <label>Note</label>
            <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <div className="row actions">
          <button className="primary" disabled={!toId || !body.trim()} onClick={send}>Send note</button>
        </div>
      </div>

      {items.length === 0 && <p className="list-empty">No notes yet.</p>}
      {items.map((n) => (
        <div key={n.id} className="card">
          <div className="meta">
            {n.from_user_id === meId
              ? `→ to ${n.to_name || n.to_email}`
              : `← from ${n.from_name || n.from_email}`}
            {' · '}{new Date(n.created_at).toLocaleString()}
            {!n.read && n.to_user_id === meId && <span style={{ color: 'var(--yellow)' }}> · unread</span>}
          </div>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.body}</div>
        </div>
      ))}
    </>
  );
}

function BookmarksPanel({ meId }: { meId: string }) {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [eventId, setEventId] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = async () => setItems(await api.get<Bookmark[]>(`/notes/bookmarks?user_id=${meId}`));
  useEffect(() => {
    load();
    api.get<CalendarEvent[]>(`/events?user_id=${meId}`).then(setEvents);
  }, [meId]);

  const add = async () => {
    setErr(null);
    try {
      await api.post('/notes/bookmarks', {
        user_id: meId,
        link_name: name,
        url,
        event_id: eventId || null,
      });
      setName(''); setUrl(''); setEventId('');
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <div className="card">
        <strong>Add bookmark</strong>
        <p className="meta" style={{ marginTop: 0 }}>
          Links must be entered as <code>{`{ link_name, url }`}</code> — no raw URLs allowed.
        </p>
        <div className="row">
          <div>
            <label>Link name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Investor deck v3" />
          </div>
          <div>
            <label>URL *</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <label style={{ marginTop: 8, display: 'block' }}>Attach to event (optional)</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">— none —</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>
        {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
        <div className="row actions">
          <button className="primary" disabled={!name.trim() || !url.trim()} onClick={add}>Save bookmark</button>
        </div>
      </div>

      {items.length === 0 && <p className="list-empty">No bookmarks yet.</p>}
      {items.map((b) => {
        const ev = events.find((e) => e.id === b.event_id);
        return (
          <div key={b.id} className="card">
            <a className="bookmark-link" href={b.url} target="_blank" rel="noreferrer">🔖 {b.link_name}</a>
            <div className="meta">
              {ev ? `attached to: ${ev.title}` : 'standalone'}{' · '}{new Date(b.created_at).toLocaleString()}
            </div>
            <div style={{ marginTop: 6 }}>
              <button onClick={async () => { await api.del(`/notes/bookmarks/${b.id}`); load(); }}>Delete</button>
            </div>
          </div>
        );
      })}
    </>
  );
}
