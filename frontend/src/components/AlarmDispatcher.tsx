import { useEffect, useRef } from 'react';
import { useAuth } from '../store/auth';
import { api } from '../api/client';
import { useToast } from '../store/toast';
import type { CalendarEvent } from '../types';

const APP_BASE = '/workspace/calendar';

/**
 * Polls the user's events and fires a toast for any alarm whose time has
 * just passed. The toast includes an "Open meeting" action that links to
 * the event's meeting_link, falling back to the in-app event view.
 *
 * State note: we track fired alarms in-memory only — refreshing the tab
 * may resurface a recent alarm, which is acceptable for a desktop calendar.
 */
export default function AlarmDispatcher() {
  const user = useAuth((s) => s.user);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const check = async () => {
      try {
        const events = await api.get<CalendarEvent[]>(`/events?user_id=${user.id}`);
        if (cancelled) return;
        const now = Date.now();
        for (const ev of events) {
          if (!ev.alarm_iso) continue;
          if (fired.current.has(ev.id)) continue;
          const t = new Date(ev.alarm_iso).getTime();
          if (Number.isNaN(t)) continue;
          // Fire if alarm is within the last 90 seconds and not in the future.
          if (t <= now && now - t < 90 * 1000) {
            fired.current.add(ev.id);
            const link = ev.meeting_link || `${APP_BASE}?date=${encodeURIComponent(ev.start_iso)}`;
            useToast.getState().show({
              variant: 'info',
              title: `⏰ ${ev.title}`,
              body: `Starts ${new Date(ev.start_iso).toLocaleTimeString()} · click to open`,
            });
            // A second, action-shaped toast with the actual link.
            useToast.getState().show({
              variant: 'success',
              title: 'Open the meeting',
              body: link,
            });
            // Best-effort opening of the meeting in a new tab.
            window.open(link, '_blank', 'noopener,noreferrer');
          }
        }
      } catch { /* network blip — try again next tick */ }
    };

    check();
    const t = setInterval(check, 30 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  return null;
}
