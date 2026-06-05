import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../store/auth';
import { useSocket } from '../store/socket';
import type { AvailabilityStatus, CalendarEvent, User } from '../types';
import { api } from '../api/client';
import { CompositeCalendarGrid, defaultWeekStart } from '../components/CalendarGrid';
import { addDays, formatInTz } from '../lib/time';
import EventModal from '../components/EventModal';
import { toastInfo } from '../store/toast';

export default function CompositeCalendarPage() {
  const me = useAuth((s) => s.user)!;
  const tz = useAuth((s) => s.timezone);
  const onlineIds = useSocket((s) => s.online);

  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set([me.id]));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => defaultWeekStart(tz));
  const [slotInvite, setSlotInvite] = useState<
    | { startIso: string; endIso: string; status: AvailabilityStatus | undefined }
    | null
  >(null);

  useEffect(() => { api.get<User[]>('/users').then(setUsers).catch(() => {}); }, []);
  useEffect(() => { setWeekStart(defaultWeekStart(tz)); }, [tz]);

  useEffect(() => {
    const ids = Array.from(selected);
    if (!ids.length) { setEvents([]); return; }
    api.get<CalendarEvent[]>(`/events?user_ids=${ids.join(',')}`).then(setEvents).catch(() => {});
  }, [selected]);

  const rangeLabel = useMemo(() => {
    const a = formatInTz(weekStart, tz, { month: 'short', day: 'numeric' });
    const b = formatInTz(addDays(weekStart, 6), tz, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${a} – ${b}`;
  }, [weekStart, tz]);

  const selectedUsers = users.filter((u) => selected.has(u.id));

  const openInvite = (info: { startIso: string; endIso: string; status: AvailabilityStatus | undefined }) => {
    if (info.status === 'yellow') {
      toastInfo('Flexible slot', 'This time is flexible but requires coordination.');
    }
    setSlotInvite(info);
  };

  return (
    <>
      <h2>Composite calendar</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Hover any cell to see its status. <strong>Green</strong> = mutual free · <strong>Yellow</strong> = flexible
        (requires coordination) · <strong>Red / Sleep</strong> = locked.
        Click an unlocked cell to instantly create an invitation for everyone selected.
      </p>

      <div className="card">
        <strong>Select teammates</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {users.map((u) => {
            const on = selected.has(u.id);
            const isOnline = onlineIds.includes(u.id);
            return (
              <button
                key={u.id}
                className={on ? 'chip on' : 'chip'}
                onClick={() => setSelected((s) => {
                  const ns = new Set(s);
                  if (ns.has(u.id)) ns.delete(u.id); else ns.add(u.id);
                  return ns;
                })}
              >
                <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                {u.display_name || u.username || u.email}{u.id === me.id && <em>&nbsp;(you)</em>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cal-toolbar">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev</button>
        <button onClick={() => setWeekStart(defaultWeekStart(tz))}>Today</button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button>
        <strong>{rangeLabel}</strong>
      </div>

      {selectedUsers.length === 0 ? (
        <p className="list-empty">Pick at least one teammate above.</p>
      ) : (
        <div className="view-fade" key={weekStart.toISOString()}>
          <CompositeCalendarGrid
            weekStart={weekStart}
            tz={tz}
            users={selectedUsers}
            events={events}
            onPickSlot={openInvite}
          />
        </div>
      )}

      {slotInvite && (
        <EventModal
          initial={{ start_iso: slotInvite.startIso, end_iso: slotInvite.endIso }}
          onClose={() => setSlotInvite(null)}
          onSaved={() => setSlotInvite(null)}
        />
      )}
    </>
  );
}
