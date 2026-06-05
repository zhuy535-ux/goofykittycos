import { useMemo } from 'react';
import type { CalendarEvent } from '../types';
import { dayInTz, formatInTz } from '../lib/time';

interface Props {
  year: number;
  tz: string;
  events: CalendarEvent[];
  onPickMonth: (monthStart: Date) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function YearGrid({ year, tz, events, onPickMonth }: Props) {
  const eventDays = useMemo(() => {
    const s = new Set<string>();
    for (const ev of events) s.add(dayKey(new Date(ev.start_iso), tz));
    return s;
  }, [events, tz]);

  const todayKey = dayKey(new Date(), tz);

  return (
    <div className="year-grid">
      {Array.from({ length: 12 }, (_, m) => {
        const monthStart = new Date(Date.UTC(year, m, 1));
        return (
          <div key={m} className="year-month" onClick={() => onPickMonth(monthStart)}>
            <h4>{formatInTz(monthStart, tz, { month: 'long' })}</h4>
            <div className="mini-grid">
              {WEEKDAYS.map((d, i) => <div key={`h${i}`} className="d dh">{d}</div>)}
              {buildCells(year, m, tz).map((c, i) => {
                const k = dayKey(c.date, tz);
                const has = eventDays.has(k);
                return (
                  <div
                    key={i}
                    className={
                      'd' +
                      (c.outside ? ' outside' : '') +
                      (has ? ' has-event' : '') +
                      (k === todayKey ? ' today' : '')
                    }
                  >
                    {parseInt(formatInTz(c.date, tz, { day: '2-digit' }), 10)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildCells(year: number, month: number, tz: string) {
  const first = new Date(Date.UTC(year, month, 1));
  const dow = dayInTz(first, tz);
  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, month, 1 - dow + i));
    const inMonth = parseInt(formatInTz(d, tz, { month: '2-digit' }), 10) === month + 1;
    cells.push({ date: d, outside: !inMonth });
  }
  return cells;
}

const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
