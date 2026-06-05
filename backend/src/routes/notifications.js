import { Router } from 'express';
import { db } from '../db/index.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json([]);
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200')
    .all(user_id);
  res.json(rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) })));
});

notificationsRouter.post('/mark-read', (req, res) => {
  const { user_id, ids } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (Array.isArray(ids) && ids.length) {
    const ph = ids.map(() => '?').join(',');
    db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${ph})`)
      .run(user_id, ...ids);
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user_id);
  }
  res.json({ ok: true });
});
