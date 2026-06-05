import { Router } from 'express';
import { randomUUID as uuid } from 'node:crypto';
import { db } from '../db/index.js';

export const applicationsRouter = Router();

applicationsRouter.get('/', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json([]);
  res.json(
    db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY position, created_at').all(user_id)
  );
});

applicationsRouter.post('/', (req, res) => {
  const { user_id, name, url, icon_id } = req.body || {};
  if (!user_id || !name || !url || !icon_id) {
    return res.status(400).json({ error: 'user_id, name, url, icon_id required' });
  }
  try { new URL(url); } catch { return res.status(400).json({ error: 'url must be valid' }); }
  const id = uuid();
  const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM applications WHERE user_id = ?').get(user_id).m;
  db.prepare(
    'INSERT INTO applications (id, user_id, name, url, icon_id, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, user_id, name.trim(), url, icon_id, max + 1);
  res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(id));
});

applicationsRouter.patch('/:id', (req, res) => {
  const sets = []; const values = [];
  for (const f of ['name', 'url', 'icon_id', 'position']) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    values.push(req.params.id);
    db.prepare(`UPDATE applications SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id));
});

applicationsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
