import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { getDeviceTz } from '../lib/time';
import { toastError } from '../store/toast';

type Tab = 'signin' | 'create' | 'join';

export default function Login() {
  const [tab, setTab] = useState<Tab>('signin');
  const setTz = useAuth((s) => s.setTimezone);
  const navigate = useNavigate();

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ width: 420 }}>
        <div className="badge-row">
          <div className="logo">E</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: 13, color: 'var(--text-1)' }}>ENTJ Workspace</strong>
            <span className="muted" style={{ fontSize: 11 }}>goofykittycos.com</span>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <button className={'tab' + (tab === 'signin' ? ' active' : '')} onClick={() => setTab('signin')}>Sign in</button>
          <button className={'tab' + (tab === 'create' ? ' active' : '')} onClick={() => setTab('create')}>Create team</button>
          <button className={'tab' + (tab === 'join'   ? ' active' : '')} onClick={() => setTab('join')}>Join with code</button>
        </div>

        {tab === 'signin' && <SigninForm onDone={() => { setTz(getDeviceTz()); navigate('/workspace/calendar'); }} />}
        {tab === 'create' && <CreateTeamForm onDone={() => { setTz(getDeviceTz()); navigate('/workspace/calendar'); }} />}
        {tab === 'join'   && <JoinTeamForm   onDone={() => { setTz(getDeviceTz()); navigate('/workspace/calendar'); }} />}
      </div>
    </div>
  );
}

function SigninForm({ onDone }: { onDone: () => void }) {
  const [emailOrUsername, setV] = useState('');
  const [password, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await useAuth.getState().signin(emailOrUsername.trim(), password);
      onDone();
    } catch (e2) {
      const msg = (e2 as Error).message;
      setErr(msg);
      toastError('Sign-in failed', msg);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <label>Username or email</label>
      <input value={emailOrUsername} onChange={(e) => setV(e.target.value)} autoFocus />
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setP(e.target.value)} />
      {err && <p style={{ color: 'var(--red)', fontSize: 13 }}>{err}</p>}
      <Actions busy={busy} label="Sign in" disabled={!emailOrUsername || !password} />
    </form>
  );
}

function CreateTeamForm({ onDone }: { onDone: () => void }) {
  const [orgName, setOrgName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await useAuth.getState().signup({
        mode: 'create_org',
        orgName: orgName.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      onDone();
    } catch (e2) {
      const msg = (e2 as Error).message;
      setErr(msg);
      toastError('Could not create workspace', msg);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
        Start a fresh workspace. You'll become the admin and get an invitation code to share with your team.
      </p>
      <label>Workspace name *</label>
      <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Goofy Kitty Cos" autoFocus />

      <label>Username * <span className="muted" style={{ fontWeight: 400 }}>(permanent)</span></label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="annie" />
      <label>Email *</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      <label>Password * <span className="muted" style={{ fontWeight: 400 }}>(8+ chars)</span></label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label>Display name (optional)</label>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

      {err && <p style={{ color: 'var(--red)', fontSize: 13 }}>{err}</p>}
      <Actions
        busy={busy}
        label="Create workspace"
        disabled={!orgName.trim() || !email || !username || password.length < 8}
      />
    </form>
  );
}

function JoinTeamForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await useAuth.getState().signup({
        mode: 'join_org',
        invitationCode: code.trim().toUpperCase(),
        email: email.trim(),
        username: username.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      onDone();
    } catch (e2) {
      const msg = (e2 as Error).message;
      setErr(msg);
      toastError('Could not join workspace', msg);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
        Got a code from your admin? Paste it here. Codes look like <span className="kbd">ENTJ-AB23-XYZ</span>.
      </p>
      <label>Invitation code *</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ENTJ-AB23-XYZ"
        autoFocus
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: '0.04em' }}
      />

      <label>Username * <span className="muted" style={{ fontWeight: 400 }}>(permanent)</span></label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mom" />
      <label>Email *</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@home.com" />
      <label>Password * <span className="muted" style={{ fontWeight: 400 }}>(8+ chars)</span></label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label>Display name (optional)</label>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

      {err && <p style={{ color: 'var(--red)', fontSize: 13 }}>{err}</p>}
      <Actions
        busy={busy}
        label="Join workspace"
        disabled={!code.trim() || !email || !username || password.length < 8}
      />
    </form>
  );
}

function Actions({ busy, label, disabled }: { busy: boolean; label: string; disabled: boolean }) {
  return (
    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="muted" style={{ fontSize: 11 }}>
        TZ <span className="kbd">{getDeviceTz()}</span>
      </span>
      <button type="submit" className="primary" disabled={busy || disabled}>
        {busy ? `${label}…` : `${label} →`}
      </button>
    </div>
  );
}
