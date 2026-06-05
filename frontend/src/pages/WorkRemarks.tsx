import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { api } from '../api/client';
import type { WorkRemark } from '../types';

export default function WorkRemarks() {
  const user = useAuth((s) => s.user)!;
  const [items, setItems] = useState<WorkRemark[]>([]);
  const [body, setBody] = useState('');

  const load = async () => setItems(await api.get<WorkRemark[]>(`/notes/remarks?user_id=${user.id}`));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!body.trim()) return;
    await api.post('/notes/remarks', { user_id: user.id, body: body.trim() });
    setBody('');
    load();
  };

  return (
    <>
      <h2>Work Remarks <span style={{ color: 'var(--text-dim)', fontSize: 14, marginLeft: 6 }}>(private)</span></h2>
      <p className="meta" style={{ marginTop: 0 }}>Only you can see these notes.</p>
      <div className="card">
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="A thought, a TODO comment, anything…" />
        <div className="row actions">
          <button className="primary" onClick={add}>Save remark</button>
        </div>
      </div>
      {items.length === 0 && <p className="list-empty">Nothing yet.</p>}
      {items.map((r) => (
        <div key={r.id} className="card">
          <div className="meta">{new Date(r.created_at).toLocaleString()}</div>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.body}</div>
          <div className="row actions">
            <button onClick={async () => { await api.del(`/notes/remarks/${r.id}`); load(); }}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}
