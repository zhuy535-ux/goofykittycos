import { Router } from 'express';
import { randomUUID as uuid } from 'node:crypto';
import { db } from '../db/index.js';

export const todosRouter = Router();

todosRouter.get('/', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json([]);
  res.json(db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY done, created_at DESC').all(user_id));
});

todosRouter.post('/', (req, res) => {
  const { user_id, title, due_iso } = req.body || {};
  if (!user_id || !title) return res.status(400).json({ error: 'user_id, title required' });
  const id = uuid();
  db.prepare(
    'INSERT INTO todos (id, user_id, title, due_iso) VALUES (?, ?, ?, ?)'
  ).run(id, user_id, title, due_iso || null);
  res.json(db.prepare('SELECT * FROM todos WHERE id = ?').get(id));
});

todosRouter.patch('/:id', (req, res) => {
  const sets = [];
  const values = [];
  for (const f of ['title', 'done', 'due_iso']) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    values.push(req.params.id);
    db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json(db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id));
});

todosRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
