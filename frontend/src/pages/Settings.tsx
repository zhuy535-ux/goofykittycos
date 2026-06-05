import { useState } from 'react';
import { useAuth } from '../store/auth';

const TZ_LIST = [
  'UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London',
  'Europe/Berlin', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
];

export default function Settings() {
  const user = useAuth((s) => s.user)!;
  const updateProfile = useAuth((s) => s.updateProfile);
  const refresh = useAuth((s) => s.refresh);

  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.display_name || '');
  const [tz, setTz] = useState(user.timezone);
  const [sleepStart, setSleepStart] = useState(user.sleep_start);
  const [sleepEnd, setSleepEnd] = useState(user.sleep_end);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (!email || !/^.+@.+\..+$/.test(email)) {
      setErr('Email is required and must be valid.');
      return;
    }
    try {
      await updateProfile({
        email, display_name: name, timezone: tz,
        sleep_start: sleepStart, sleep_end: sleepEnd,
      });
      useAuth.getState().setTimezone(tz);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <h2>Settings</h2>
      <div className="card" style={{ maxWidth: 520 }}>
        <label>Email *</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        <label style={{ marginTop: 10, display: 'block' }}>Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label style={{ marginTop: 10, display: 'block' }}>Timezone</label>
        <select value={tz} onChange={(e) => setTz(e.target.value)}>
          {!TZ_LIST.includes(tz) && <option value={tz}>{tz}</option>}
          {TZ_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label>Sleep / off-hours start</label>
            <select value={sleepStart} onChange={(e) => setSleepStart(parseInt(e.target.value, 10))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label>Sleep / off-hours end</label>
            <select value={sleepEnd} onChange={(e) => setSleepEnd(parseInt(e.target.value, 10))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        </div>

        {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
        {saved && <p style={{ color: 'var(--green)' }}>Saved.</p>}
        <div className="row actions">
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}
