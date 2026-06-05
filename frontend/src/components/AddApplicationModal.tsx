import { useState } from 'react';
import { useAuth } from '../store/auth';
import { api } from '../api/client';
import { iconGallery } from './AppIcons';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AddApplicationModal({ onClose, onSaved }: Props) {
  const user = useAuth((s) => s.user)!;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [iconId, setIconId] = useState(iconGallery()[0].id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null); setBusy(true);
    try {
      await api.post('/applications', {
        user_id: user.id,
        name: name.trim(),
        url: url.trim(),
        icon_id: iconId,
      });
      onSaved(); onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add application shortcut</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Link any external tool. It will appear as a clickable icon in your sidebar.
        </p>

        <label>App name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Investor CRM" />

        <label>URL *</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />

        <label>Icon</label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 8,
            padding: 8,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-muted)',
          }}
        >
          {iconGallery().map((g) => {
            const on = g.id === iconId;
            return (
              <button
                key={g.id}
                onClick={() => setIconId(g.id)}
                title={g.label}
                style={{
                  display: 'grid', placeItems: 'center', height: 40,
                  background: on ? 'var(--primary-black)' : 'var(--bg)',
                  color: on ? '#fff' : 'var(--text-1)',
                  border: '1px solid ' + (on ? 'var(--primary-black)' : 'var(--border)'),
                }}
              >
                {g.render(20)}
              </button>
            );
          })}
        </div>

        {err && <p style={{ color: 'var(--red)' }}>{err}</p>}

        <div className="row actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !name.trim() || !url.trim()} onClick={save}>
            Add to sidebar
          </button>
        </div>
      </div>
    </div>
  );
}
