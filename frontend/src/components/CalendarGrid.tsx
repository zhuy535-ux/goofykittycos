import { useMemo } from 'react';
import type { AvailabilityStatus, CalendarEvent, User } from '../types';
import { addDays, dayInTz, formatInTz, startOfWeekInTz } from '../lib/time';
import { isSlotSelectable, worstStatus } from '../lib/availability';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const QUARTERS = [0, 1, 2, 3];          // 4 × 15-min sub-slots per hour
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Visual scale. Updating these is the single source of truth for grid height.
const HOUR_PX = 48;                     // height of one hour row
const QUARTER_PX = HOUR_PX / 4;         // 12 px per 15-min slot

interface PersonalGridProps {
  weekStart: Date;
  tz: string;
  user: User;
  events: CalendarEvent[];
  onCellClick: (startIso: string, endIso: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
}

/**
 * Pixel-perfect week view.
 *
 * Each day is its own absolute-positioned column. Events are placed by
 * top/height computed from their real start/end times, so a 22-minute event
 * actually looks 22 minutes tall and an event starting at 3:45 starts at
 * the ¾-mark of the 3 o'clock row.
 */
export function PersonalCalendarGrid({ weekStart, tz, user, events, onCellClick, onEventClick }: PersonalGridProps) {
  const inSleep = (hour: number) => {
    const { sleep_start, sleep_end } = user;
    if (sleep_start === sleep_end) return false;
    if (sleep_start < sleep_end) return hour >= sleep_start && hour < sleep_end;
    return hour >= sleep_start || hour < sleep_end;
  };

  const placedByDay = useMemo(() => placeEvents(events, weekStart, tz), [events, weekStart, tz]);

  return (
    <div className="pp-grid">
      <div className="pp-corner" />
      {DAY_NAMES.map((d, i) => {
        const day = addDays(weekStart, i);
        return (
          <div key={d} className="pp-dayhead">
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>{d}</span>
            <span className="dnum">{parseInt(formatInTz(day, tz, { day: '2-digit' }), 10)}</span>
          </div>
        );
      })}

      <div className="pp-times">
        {HOURS.map((h) => (
          <div key={h} className="pp-time-cell" style={{ height: HOUR_PX }}>
            <span>{String(h).padStart(2, '0')}:00</span>
          </div>
        ))}
      </div>

      {Array.from({ length: 7 }, (_, day) => {
        const placed = placedByDay[day] || [];
        // Cell set used for sleep×event collision (deep grey).
        const eventQuarterSet = new Set<string>();
        for (const p of placed) {
          if (p.event.availability_status === 'green') continue;
          for (let q = p.startQuarter; q < p.endQuarter; q++) eventQuarterSet.add(`${q}`);
        }
        return (
          <div key={day} className="pp-daycol" style={{ height: HOUR_PX * 24 }}>
            {/* hour guide rows + click targets at quarter resolution */}
            {HOURS.map((h) => (
              <div key={h} className="pp-hour" style={{ height: HOUR_PX, top: h * HOUR_PX }}>
                {QUARTERS.map((q) => {
                  const qIndex = h * 4 + q;
                  const collision = inSleep(h) && eventQuarterSet.has(`${qIndex}`);
                  const sleep = inSleep(h) && !collision;
                  return (
                    <div
                      key={q}
                      className={
                        'pp-quarter' +
                        (collision ? ' collision' : '') +
                        (sleep ? ' sleep' : '')
                      }
                      style={{ height: QUARTER_PX }}
                      title={collision ? 'Sleep window overlaps a scheduled event' : undefined}
                      onClick={() => {
                        // Build a 30-min default starting at the clicked quarter.
                        const start = quarterToInstant(weekStart, day, qIndex, tz);
                        const end = new Date(start.getTime() + 30 * 60 * 1000);
                        onCellClick(start.toISOString(), end.toISOString());
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* absolute-positioned events */}
            {placed.map((p) => {
              const perm = isSlotSelectable(p.event.availability_status);
              return (
                <div
                  key={p.event.id}
                  className={`pp-event ${p.event.availability_status}`}
                  style={{
                    top: p.startQuarter * QUARTER_PX,
                    height: Math.max(QUARTER_PX, (p.endQuarter - p.startQuarter) * QUARTER_PX),
                    left: `calc(${p.column * (100 / p.columnCount)}% + 2px)`,
                    width: `calc(${100 / p.columnCount}% - 4px)`,
                  }}
                  title={`${p.event.title} · ${perm.tooltip}`}
                  onClick={(e) => { e.stopPropagation(); onEventClick(p.event); }}
                >
                  <strong>{p.event.title}</strong>
                  <span className="pp-event-meta">{formatTimeRange(p.event, tz)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// === Composite (constraint engine) =========================================

interface CompositeGridProps {
  weekStart: Date;
  tz: string;
  users: User[];
  events: CalendarEvent[];
  onPickSlot: (info: {
    startIso: string;
    endIso: string;
    status: AvailabilityStatus | undefined;
  }) => void;
}

/**
 * Hour-level overlay view that fuses every selected user's status per cell.
 *
 * Cell color encodes the WORST status across users:
 *   green  → mutual free
 *   yellow → flexible for at least one (warn on click)
 *   red    → blocked for at least one (cannot click, "Non-negotiable")
 *   sleep  → at least one user is in sleep (treated like red)
 */
export function CompositeCalendarGrid({ weekStart, tz, users, events, onPickSlot }: CompositeGridProps) {
  const statusByDayHour = useMemo(() => {
    const out: (AvailabilityStatus | undefined)[][] = Array.from({ length: 7 }, () => Array(24).fill(undefined));
    if (!users.length) return out;
    const weekEnd = addDays(weekStart, 7);

    // Sleep windows: each user contributes a 'red' equivalent in those hours.
    const sleep: boolean[][] = Array.from({ length: 7 }, () => Array(24).fill(false));
    for (const u of users) {
      for (let h = 0; h < 24; h++) {
        const inS =
          u.sleep_start < u.sleep_end
            ? h >= u.sleep_start && h < u.sleep_end
            : u.sleep_start !== u.sleep_end && (h >= u.sleep_start || h < u.sleep_end);
        if (inS) for (let d = 0; d < 7; d++) sleep[d][h] = true;
      }
    }

    // Events touched per (day, hour).
    const byCell: AvailabilityStatus[][][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => [])
    );
    for (const ev of events) {
      if (!users.find((u) => u.id === ev.user_id)) continue;
      const start = new Date(ev.start_iso);
      const end = new Date(ev.end_iso);
      if (end <= weekStart || start >= weekEnd) continue;
      const clamped = start < weekStart ? weekStart : start;
      const clampedEnd = end > weekEnd ? weekEnd : end;
      for (let t = clamped.getTime(); t < clampedEnd.getTime(); t += 15 * 60 * 1000) {
        const d = new Date(t);
        const day = dayInTz(d, tz);
        const hour = parseInt(
          new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(d),
          10
        ) % 24;
        byCell[day][hour].push(ev.availability_status);
      }
    }

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const status = worstStatus(byCell[d][h]);
        if (sleep[d][h]) out[d][h] = 'red';     // sleep = blocked
        else if (status) out[d][h] = status;
        else out[d][h] = 'green';                // no events, awake → mutual free
      }
    }
    return out;
  }, [users, events, weekStart, tz]);

  return (
    <div className="pp-grid">
      <div className="pp-corner" />
      {DAY_NAMES.map((d, i) => {
        const day = addDays(weekStart, i);
        return (
          <div key={d} className="pp-dayhead">
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>{d}</span>
            <span className="dnum">{parseInt(formatInTz(day, tz, { day: '2-digit' }), 10)}</span>
          </div>
        );
      })}

      <div className="pp-times">
        {HOURS.map((h) => (
          <div key={h} className="pp-time-cell" style={{ height: HOUR_PX }}>
            <span>{String(h).padStart(2, '0')}:00</span>
          </div>
        ))}
      </div>

      {Array.from({ length: 7 }, (_, day) => (
        <div key={day} className="pp-daycol pp-composite" style={{ height: HOUR_PX * 24 }}>
          {HOURS.map((h) => {
            const status = statusByDayHour[day][h];
            const perm = isSlotSelectable(status);
            return (
              <div
                key={h}
                className={
                  'pp-comp-cell' +
                  (status === 'green' ? ' is-green' : '') +
                  (status === 'yellow' ? ' is-yellow' : '') +
                  (status === 'red' ? ' is-red' : '') +
                  (perm.selectable ? ' selectable' : ' locked')
                }
                style={{ height: HOUR_PX, top: h * HOUR_PX }}
                title={perm.tooltip}
                onClick={() => {
                  if (!perm.selectable) return;
                  const start = quarterToInstant(weekStart, day, h * 4, tz);
                  const end = new Date(start.getTime() + 60 * 60 * 1000);
                  onPickSlot({ startIso: start.toISOString(), endIso: end.toISOString(), status });
                }}
              >
                {perm.selectable && (
                  <span className="pp-invite-pip">
                    {status === 'yellow' ? 'Flex · click to invite' : 'Free · click to invite'}
                  </span>
                )}
                {!perm.selectable && <span className="pp-locked-pip">Locked</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// === Helpers ==============================================================

export function defaultWeekStart(tz: string): Date {
  return startOfWeekInTz(new Date(), tz);
}

interface PlacedEvent {
  event: CalendarEvent;
  startQuarter: number;  // 0..95 within the day
  endQuarter: number;
  column: number;
  columnCount: number;
}

/**
 * Lay out events for a week. For each day we:
 *   1. Convert start/end to quarter indices (0..95).
 *   2. Sort by start, then sweep to detect overlap clusters.
 *   3. Within each cluster, split into columns so overlapping events sit
 *      side-by-side instead of on top of each other.
 */
function placeEvents(events: CalendarEvent[], weekStart: Date, tz: string): PlacedEvent[][] {
  const out: PlacedEvent[][] = Array.from({ length: 7 }, () => []);
  const weekEnd = addDays(weekStart, 7);

  // Bucket each event into the day it starts in.
  for (const ev of events) {
    const start = new Date(ev.start_iso);
    const end = new Date(ev.end_iso);
    if (end <= weekStart || start >= weekEnd) continue;
    const clampedStart = start < weekStart ? weekStart : start;
    const clampedEnd = end > weekEnd ? weekEnd : end;
    const day = dayInTz(clampedStart, tz);
    const startQuarter = quarterIndexInTz(clampedStart, tz);
    const endQuarter = Math.max(startQuarter + 1, quarterIndexInTz(clampedEnd, tz));
    out[day].push({ event: ev, startQuarter, endQuarter, column: 0, columnCount: 1 });
  }

  // Column-pack each day.
  for (let d = 0; d < 7; d++) {
    const items = out[d];
    items.sort((a, b) => a.startQuarter - b.startQuarter || a.endQuarter - b.endQuarter);

    // Greedy assignment: each event takes the smallest-index column whose
    // current "end" is ≤ this event's start.
    const columnEnds: number[] = [];
    for (const p of items) {
      let col = columnEnds.findIndex((endQ) => endQ <= p.startQuarter);
      if (col === -1) { col = columnEnds.length; columnEnds.push(0); }
      columnEnds[col] = p.endQuarter;
      p.column = col;
    }
    const cols = Math.max(1, columnEnds.length);
    for (const p of items) p.columnCount = cols;
  }

  return out;
}

function quarterIndexInTz(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  return hour * 4 + Math.floor(minute / 15);
}

function quarterToInstant(weekStart: Date, day: number, quarter: number, tz: string): Date {
  // Anchor: weekStart at 00:00 in tz. Convert (day, quarter) to wall-clock
  // and rebuild an instant.
  const baseParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(weekStart);
  const get = (t: string) => parseInt(baseParts.find((p) => p.type === t)!.value, 10);
  const hour = Math.floor(quarter / 4);
  const minute = (quarter % 4) * 15;
  // Build a naive instant for that wall-clock-in-tz, then correct for tz offset.
  const naive = Date.UTC(get('year'), get('month') - 1, get('day') + day, hour, minute);
  const probe = new Date(naive);
  const tzWallParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(probe);
  const pGet = (t: string) => parseInt(tzWallParts.find((p) => p.type === t)!.value, 10);
  const tzWall = Date.UTC(pGet('year'), pGet('month') - 1, pGet('day'), pGet('hour') % 24, pGet('minute'));
  const offsetMs = tzWall - naive;
  return new Date(naive - offsetMs);
}

function formatTimeRange(ev: CalendarEvent, tz: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date(iso));
  return `${fmt(ev.start_iso)} – ${fmt(ev.end_iso)}`;
}
