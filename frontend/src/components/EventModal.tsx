import { useEffect, useMemo, useRef, useState } from 'react';
import type { AvailabilityStatus, CalendarEvent, MeetingProvider, Recurrence, User } from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../store/auth';
import { toastError, toastSuccess } from '../store/toast';

interface Props {
  initial?: Partial<CalendarEvent> & { start_iso: string; end_iso: string };
  existing?: CalendarEvent | null;
  onClose: () => void;
  onSaved: (ev: CalendarEvent) => void;
}

const BUILTIN_CATEGORIES = ['Learning', 'Private', 'Startup Work'];
const RECURRENCES: Recurrence[] = ['None', 'Weekly', 'Monthly', 'Yearly'];
const PROVIDERS: { id: MeetingProvider; label: string }[] = [
  { id: 'wechat', label: 'WeChat' },
  { id: 'tencent', label: 'Tencent Meeting' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'google_meet', label: 'Google Meet' },
];
const ALARM_PRESETS: { key: string; label: string; minutes: number | null }[] = [
  { key: 'none', label: 'None',                minutes: null },
  { key: 'at',   label: 'At time of event',    minutes: 0 },
  { key: 'm5',   label: '5 minutes before',    minutes: 5 },
  { key: 'm15',  label: '15 minutes before',   minutes: 15 },
  { key: 'h1',   label: '1 hour before',       minutes: 60 },
  { key: 'd1',   label: '1 day before',        minutes: 24 * 60 },
];

interface Errors {
  title?: string;
  start_iso?: string;
  end_iso?: string;
  category?: string;
}

export default function EventModal({ initial, existing, onClose, onSaved }: Props) {
  const user = useAuth((s) => s.user)!;
  const tz = useAuth((s) => s.timezone);
  const titleRef = useRef<HTMLInputElement>(null);

  const initialCat = existing?.category ?? 'Startup Work';
  const initialIsOther = !BUILTIN_CATEGORIES.includes(initialCat);
  const [category, setCategory] = useState<string>(initialIsOther ? 'Other' : initialCat);
  const [customCategory, setCustomCategory] = useState<string>(initialIsOther ? initialCat : '');

  const [title, setTitle] = useState(existing?.title || '');
  const [startIso, setStartIso] = useState(existing?.start_iso || initial?.start_iso || '');
  const [endIso, setEndIso] = useState(existing?.end_iso || initial?.end_iso || '');
  const [availability, setAvailability] = useState<AvailabilityStatus>(existing?.availability_status || 'red');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [meetingLink, setMeetingLink] = useState(existing?.meeting_link || '');
  const [provider, setProvider] = useState<MeetingProvider | ''>(existing?.meeting_provider || '');
  const [recurrence, setRecurrence] = useState<Recurrence>(existing?.recurrence || 'None');

  const initialAlarmMinutes = useMemo(() => alarmOffsetMinutes(existing), [existing]);
  const initialPresetKey = useMemo(() => {
    if (initialAlarmMinutes == null) return 'none';
    const hit = ALARM_PRESETS.find((p) => p.minutes === initialAlarmMinutes);
    return hit ? hit.key : 'custom';
  }, [initialAlarmMinutes]);
  const [alarmPreset, setAlarmPreset] = useState<string>(initialPresetKey);
  const [customAlarmValue, setCustomAlarmValue] = useState<number>(
    initialPresetKey === 'custom' ? (initialAlarmMinutes! >= 60 ? Math.round(initialAlarmMinutes! / 60) : initialAlarmMinutes!) : 30
  );
  const [customAlarmUnit, setCustomAlarmUnit] = useState<'minutes' | 'hours' | 'days'>(
    initialPresetKey === 'custom' && initialAlarmMinutes! >= 60 ? 'hours' : 'minutes'
  );

  const [users, setUsers] = useState<User[]>([]);
  const [inviteIds, setInviteIds] = useState<string[]>([]);

  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  // Auto-focus title on mount.
  useEffect(() => { titleRef.current?.focus(); titleRef.current?.select(); }, []);

  useEffect(() => {
    api.get<User[]>('/users').then((rows) => setUsers(rows.filter((u) => u.id !== user.id))).catch(() => {});
  }, [user.id]);

  const finalCategory = category === 'Other' ? customCategory.trim() : category;
  const finalAlarmIso = useMemo(() => {
    if (!startIso) return null;
    let minutes: number | null = null;
    if (alarmPreset === 'none') return null;
    if (alarmPreset === 'custom') {
      const mult = customAlarmUnit === 'hours' ? 60 : customAlarmUnit === 'days' ? 24 * 60 : 1;
      minutes = customAlarmValue * mult;
    } else {
      minutes = ALARM_PRESETS.find((p) => p.key === alarmPreset)?.minutes ?? null;
    }
    if (minutes == null) return null;
    return new Date(new Date(startIso).getTime() - minutes * 60 * 1000).toISOString();
  }, [startIso, alarmPreset, customAlarmValue, customAlarmUnit]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Please enter a title.';
    if (!startIso) e.start_iso = 'Start time is required.';
    if (!endIso) e.end_iso = 'End time is required.';
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      e.end_iso = 'End time must be after start time.';
    }
    if (!finalCategory) {
      e.category = category === 'Other'
        ? 'Please enter a custom category name.'
        : 'Please pick a category.';
    }
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const payload = {
        user_id: user.id,
        title: title.trim(),
        start_iso: startIso,
        end_iso: endIso,
        timezone: tz,
        category: finalCategory,
        notes,
        alarm_iso: finalAlarmIso,
        location,
        meeting_link: meetingLink,
        meeting_provider: provider || null,
        recurrence,
        availability_status: availability,
      };
      const saved = existing
        ? await api.patch<CalendarEvent>(`/events/${existing.id}`, payload)
        : await api.post<CalendarEvent>('/events', payload);

      for (const toId of inviteIds) {
        try {
          await api.post('/invitations', {
            event_id: saved.id,
            from_user_id: user.id,
            to_user_id: toId,
            message: notes || null,
          });
        } catch (err) {
          toastError('Invitation failed', (err as Error).message);
        }
      }

      toastSuccess(existing ? 'Event saved' : 'Event created', saved.title);
      onSaved(saved);
    } catch (err) {
      const apiErr = err as ApiError;
      // Surface server-side validation as field errors when we can.
      if (apiErr.status === 400 && /start_iso|end_iso/.test(apiErr.message)) {
        setErrors((cur) => ({ ...cur, end_iso: apiErr.message }));
      } else if (apiErr.code === 'USER_NOT_FOUND' || apiErr.status === 409) {
        toastError('Session expired', 'Please sign in again.');
        useAuth.getState().logout();
        onClose();
        return;
      }
      toastError(existing ? 'Failed to save event' : 'Failed to create event', apiErr.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm('Delete this event?')) return;
    setBusy(true);
    try {
      await api.del(`/events/${existing.id}`);
      toastSuccess('Event deleted', existing.title);
      onSaved({ ...existing, id: '__deleted__:' + existing.id } as CalendarEvent);
    } catch (err) {
      toastError('Failed to delete event', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Enter = submit, Esc = close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault(); save(); return;
      }
      // Plain Enter submits unless focus is in the textarea.
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, title, startIso, endIso, category, customCategory, availability, recurrence, location, meetingLink, provider, notes, inviteIds, alarmPreset, customAlarmValue, customAlarmUnit]);

  const fieldErr = (k: keyof Errors) =>
    errors[k] ? <div className="field-error">{errors[k]}</div> : null;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{existing ? 'Edit event' : 'New event'}</h2>

        <label>Title *</label>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!errors.title}
        />
        {fieldErr('title')}

        <div className="row" style={{ marginTop: 8 }}>
          <div>
            <label>Start *</label>
            <input
              type="datetime-local"
              value={toLocal(startIso)}
              onChange={(e) => setStartIso(fromLocal(e.target.value))}
              aria-invalid={!!errors.start_iso}
            />
            {fieldErr('start_iso')}
          </div>
          <div>
            <label>End *</label>
            <input
              type="datetime-local"
              value={toLocal(endIso)}
              onChange={(e) => setEndIso(fromLocal(e.target.value))}
              aria-invalid={!!errors.end_iso}
            />
            {fieldErr('end_iso')}
          </div>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <div>
            <label>Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={!!errors.category}>
              {BUILTIN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Other">Other…</option>
            </select>
            {category === 'Other' && (
              <input
                style={{ marginTop: 6 }}
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Type a custom category"
                aria-invalid={!!errors.category}
              />
            )}
            {fieldErr('category')}
          </div>
          <div>
            <label>Availability</label>
            <select value={availability} onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}>
              <option value="red">🔴 Do Not Disturb</option>
              <option value="yellow">🟡 Flexible</option>
              <option value="green">🟢 Free</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <div>
            <label>Recurrence</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {RECURRENCES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label>Alarm</label>
            <select value={alarmPreset} onChange={(e) => setAlarmPreset(e.target.value)}>
              {ALARM_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              <option value="custom">Custom…</option>
            </select>
            {alarmPreset === 'custom' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  type="number"
                  min={1}
                  value={customAlarmValue}
                  onChange={(e) => setCustomAlarmValue(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  style={{ width: 90 }}
                />
                <select
                  value={customAlarmUnit}
                  onChange={(e) => setCustomAlarmUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                >
                  <option value="minutes">minutes before</option>
                  <option value="hours">hours before</option>
                  <option value="days">days before</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <label style={{ marginTop: 8 }}>Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} />

        <div className="row" style={{ marginTop: 8 }}>
          <div>
            <label>Meeting provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as MeetingProvider)}>
              <option value="">— none —</option>
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label>Meeting link</label>
            <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://" />
          </div>
        </div>

        <label style={{ marginTop: 8 }}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

        {!existing && (
          <>
            <label style={{ marginTop: 8 }}>Invite teammates</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {users.map((u) => {
                const on = inviteIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    className={on ? 'chip on' : 'chip'}
                    onClick={() => setInviteIds((ids) => on ? ids.filter((i) => i !== u.id) : [...ids, u.id])}
                  >
                    {u.display_name || u.email}
                  </button>
                );
              })}
              {users.length === 0 && <span className="muted">No teammates yet. Use the "+" button in the top bar.</span>}
            </div>
          </>
        )}

        <div className="row actions">
          {existing && <button className="danger" onClick={remove} disabled={busy}>Delete</button>}
          <button onClick={onClose} disabled={busy}>Cancel <span className="kbd">Esc</span></button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : (existing ? 'Save' : 'Create')} <span className="kbd">⏎</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocal(s: string): string {
  if (!s) return '';
  return new Date(s).toISOString();
}

function alarmOffsetMinutes(existing?: CalendarEvent | null): number | null {
  if (!existing?.alarm_iso || !existing?.start_iso) return null;
  const diff = new Date(existing.start_iso).getTime() - new Date(existing.alarm_iso).getTime();
  if (diff < 0) return null;
  return Math.round(diff / 60000);
}
