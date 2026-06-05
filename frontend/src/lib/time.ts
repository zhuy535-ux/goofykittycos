// Lightweight timezone helpers using Intl. We avoid date-fns-tz to keep
// the dep tree small; everything works in any IANA tz the browser supports.

export function getDeviceTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// Returns the wall-clock hour (0-23) of an instant in a given tz.
export function hourInTz(date: Date, tz: string): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', hour12: false,
  }).format(date);
  return parseInt(s, 10) % 24;
}

// Returns the wall-clock day-of-week (0=Sun) in a given tz.
export function dayInTz(date: Date, tz: string): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short',
  }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(s);
}

export function formatInTz(d: Date, tz: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(d);
}

// Local-input helpers: build an ISO instant from a Y-M-D-H-M and a tz.
// We construct it by trying offsets — accurate enough for scheduling.
export function localToInstant(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  // Compute the offset of "now" in tz; build naive UTC and shift.
  // For full DST-correctness we'd use a full tz lib, but Intl gives us
  // a usable approximation by computing the offset at the chosen time.
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const probe = new Date(naive);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(probe);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  const tzWall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  const offsetMs = tzWall - naive;
  return new Date(naive - offsetMs);
}

export function startOfWeekInTz(date: Date, tz: string): Date {
  // Sunday start.
  const dow = dayInTz(date, tz);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  return localToInstant(get('year'), get('month'), get('day') - dow, 0, 0, tz);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 3600 * 1000);
}

export function isoOfCell(weekStart: Date, day: number, hour: number, tz: string): { start: string; end: string } {
  const ws = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(weekStart);
  const get = (t: string) => parseInt(ws.find((p) => p.type === t)!.value, 10);
  const start = localToInstant(get('year'), get('month'), get('day') + day, hour, 0, tz);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// For overlap: bucket an event into the (day, hour) cells of a given week.
export function eventCells(eventStart: Date, eventEnd: Date, weekStart: Date, tz: string): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  const weekEnd = addDays(weekStart, 7);
  if (eventEnd <= weekStart || eventStart >= weekEnd) return cells;
  const start = eventStart < weekStart ? weekStart : eventStart;
  const end = eventEnd > weekEnd ? weekEnd : eventEnd;
  // Walk hour-by-hour. For weekly grids 24*7=168 max, trivial cost.
  for (let t = start.getTime(); t < end.getTime(); t += 60 * 60 * 1000) {
    const d = new Date(t);
    const day = dayInTz(d, tz);
    const hour = hourInTz(d, tz);
    cells.push([day, hour]);
  }
  return cells;
}
