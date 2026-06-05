import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useSocket } from '../store/socket';
import type { CalendarEvent } from '../types';
import { api } from '../api/client';
import { PersonalCalendarGrid, defaultWeekStart } from '../components/CalendarGrid';
import { MonthGrid } from '../components/MonthGrid';
import { YearGrid } from '../components/YearGrid';
import { addDays, formatInTz, startOfWeekInTz } from '../lib/time';
import EventModal from '../components/EventModal';

const COMMON_TZ = [
  'UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London',
  'Europe/Berlin', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
];

type Mode = 'week' | 'month' | 'year';

export default function PersonalCalendar() {
  const user = useAuth((s) => s.user)!;
  const tz = useAuth((s) => s.timezone);
  const setTz = useAuth((s) => s.setTimezone);
  const socket = useSocket((s) => s.socket);
  const [params, setParams] = useSearchParams();

  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState<Date>(() => defaultWeekStart(tz));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modal, setModal] = useState<
    | { mode: 'new'; start: string; end: string }
    | { mode: 'edit'; ev: CalendarEvent }
    | null
  >(null);

  // ?date=… from global-search jumps the calendar to that date.
  useEffect(() => {
    const d = params.get('date');
    if (d) {
      const target = new Date(d);
      setMode('week');
      setAnchor(startOfWeekInTz(target, tz));
      params.delete('date');
      setParams(params, { replace: true });
    }
  }, [params, setParams, tz]);

  const load = async () => {
    const rows = await api.get<CalendarEvent[]>(`/events?user_id=${user.id}`);
    setEvents(rows);
  };
  useEffect(() => { load(); }, [user.id]);
  useEffect(() => { setAnchor(defaultWeekStart(tz)); }, [tz]);

  useEffect(() => {
    if (!socket) return;
    const onCreate = (ev: CalendarEvent) => { if (ev.user_id === user.id) setEvents((es) => [...es, ev]); };
    const onUpdate = (ev: CalendarEvent) => { if (ev.user_id === user.id) setEvents((es) => es.map((e) => e.id === ev.id ? ev : e)); };
    const onDelete = ({ id }: { id: string; user_id: string }) =>
      setEvents((es) => es.filter((e) => e.id !== id));
    socket.on('event:created', onCreate);
    socket.on('event:updated', onUpdate);
    socket.on('event:deleted', onDelete);
    return () => {
      socket.off('event:created', onCreate);
      socket.off('event:updated', onUpdate);
      socket.off('event:deleted', onDelete);
    };
  }, [socket, user.id]);

  // Title text per mode.
  const rangeLabel = useMemo(() => {
    if (mode === 'week') {
      const a = formatInTz(anchor, tz, { month: 'short', day: 'numeric' });
      const b = formatInTz(addDays(anchor, 6), tz, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${a} – ${b}`;
    }
    if (mode === 'month') return formatInTz(anchor, tz, { month: 'long', year: 'numeric' });
    return formatInTz(anchor, tz, { year: 'numeric' });
  }, [anchor, mode, tz]);

  const jump = (delta: number) => {
    if (mode === 'week') setAnchor(addDays(anchor, 7 * delta));
    else if (mode === 'month') {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(anchor);
      const y = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
      const m = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
      setAnchor(new Date(Date.UTC(y, m - 1 + delta, 1)));
    } else {
      const y = parseInt(formatInTz(anchor, tz, { year: 'numeric' }), 10);
      setAnchor(new Date(Date.UTC(y + delta, 0, 1)));
    }
  };

  const goToday = () => {
    if (mode === 'week') setAnchor(defaultWeekStart(tz));
    else if (mode === 'month') {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(now);
      const y = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
      const m = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
      setAnchor(new Date(Date.UTC(y, m - 1, 1)));
    } else {
      const y = parseInt(formatInTz(new Date(), tz, { year: 'numeric' }), 10);
      setAnchor(new Date(Date.UTC(y, 0, 1)));
    }
  };

  return (
    <>
      <div className="cal-toolbar">
        <button onClick={() => jump(-1)}>←</button>
        <button onClick={goToday}>Today</button>
        <button onClick={() => jump(+1)}>→</button>
        <strong style={{ marginLeft: 8 }}>{rangeLabel}</strong>

        <div className="grow" />

        <div className="view-switcher">
          {(['week', 'month', 'year'] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ width: 200 }}>
          {!COMMON_TZ.includes(tz) && <option value={tz}>{tz}</option>}
          {COMMON_TZ.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <button
          className="primary"
          onClick={() => {
            const now = new Date();
            const end = new Date(now.getTime() + 60 * 60 * 1000);
            setModal({ mode: 'new', start: now.toISOString(), end: end.toISOString() });
          }}
        >
          + New event
        </button>
      </div>

      <div className="view-fade" key={mode}>
        {mode === 'week' && (
          <PersonalCalendarGrid
            weekStart={anchor}
            tz={tz}
            user={user}
            events={events}
            onCellClick={(start, end) => setModal({ mode: 'new', start, end })}
            onEventClick={(ev) => setModal({ mode: 'edit', ev })}
          />
        )}
        {mode === 'month' && (
          <MonthGrid
            monthStart={anchor}
            tz={tz}
            events={events}
            onPickDay={(d) => { setAnchor(startOfWeekInTz(d, tz)); setMode('week'); }}
          />
        )}
        {mode === 'year' && (
          <YearGrid
            year={parseInt(formatInTz(anchor, tz, { year: 'numeric' }), 10)}
            tz={tz}
            events={events}
            onPickMonth={(d) => { setAnchor(d); setMode('month'); }}
          />
        )}
      </div>

      {mode === 'week' && (
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#FEE2E2', border: '1px solid #FCA5A5', verticalAlign: 'middle', marginRight: 4 }}/> do not disturb &nbsp;
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#FEF3C7', border: '1px solid #FCD34D', verticalAlign: 'middle', marginRight: 4 }}/> flexible &nbsp;
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#D1FAE5', border: '1px solid #6EE7B7', verticalAlign: 'middle', marginRight: 4 }}/> free &nbsp;
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--sleep)', verticalAlign: 'middle', marginRight: 4 }}/> sleep &nbsp;
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--collision)', verticalAlign: 'middle', marginRight: 4 }}/> sleep ↔ event collision (after tz shift)
        </p>
      )}

      {modal?.mode === 'new' && (
        <EventModal
          initial={{ start_iso: modal.start, end_iso: modal.end }}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal?.mode === 'edit' && (
        <EventModal
          existing={modal.ev}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}
