import { useMemo } from 'react';
import type { CalendarEvent } from '../types';
import { dayInTz, formatInTz } from '../lib/time';

interface Props {
  monthStart: Date;
  tz: string;
  events: CalendarEvent[];
  onPickDay: (d: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthGrid({ monthStart, tz, events, onPickDay }: Props) {
  // Build a 42-cell grid (6 rows × 7 days).
  const days = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(monthStart);
    const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
    const y = get('year'), m = get('month');

    // First day of month, then back up to previous Sunday.
    const first = new Date(Date.UTC(y, m - 1, 1));
    const dow = dayInTz(first, tz);
    const cells: { date: Date; outside: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(Date.UTC(y, m - 1, 1 - dow + i));
      const partsD = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: '2-digit' }).format(d);
      cells.push({ date: d, outside: parseInt(partsD, 10) !== m });
    }
    return cells;
  }, [monthStart, tz]);

  const todayKey = useMemo(() => keyOf(new Date(), tz), [tz]);

  // Bucket events by day key.
  const evByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const k = keyOf(new Date(ev.start_iso), tz);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    return map;
  }, [events, tz]);

  return (
    <div className="month-grid">
      {WEEKDAYS.map((d) => <div key={d} className="month-head">{d}</div>)}
      {days.map((c, i) => {
        const k = keyOf(c.date, tz);
        const evs = evByDay.get(k) || [];
        const isToday = k === todayKey;
        return (
          <div
            key={i}
            className={'month-cell' + (c.outside ? ' outside' : '') + (isToday ? ' today' : '')}
            onClick={() => onPickDay(c.date)}
          >
            <span className="dnum">{parseInt(formatInTz(c.date, tz, { day: '2-digit' }), 10)}</span>
            {evs.slice(0, 3).map((ev) => (
              <span key={ev.id} className={`ev-strip ${barClass(ev.availability_status)}`}>
                {labelFor(ev)}
              </span>
            ))}
            {evs.length > 3 && (
              <span className="ev-strip" style={{ color: 'var(--text-dim)' }}>+{evs.length - 3} more</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const keyOf = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const barClass = (a: string) =>
  a === 'green' ? 'ev-green' : a === 'yellow' ? 'ev-yellow' : 'ev-red';

const labelFor = (ev: CalendarEvent) => ev.title;

// Inline styles for the bar colors so we don't have to edit global.css.
const barStyles = `
.ev-strip.ev-red    { background: #FEE2E2; color: #991B1B; }
.ev-strip.ev-yellow { background: #FEF3C7; color: #92400E; }
.ev-strip.ev-green  { background: #D1FAE5; color: #065F46; }
`;
if (typeof document !== 'undefined' && !document.getElementById('__month_grid_bars')) {
  const s = document.createElement('style');
  s.id = '__month_grid_bars';
  s.textContent = barStyles;
  document.head.appendChild(s);
}

