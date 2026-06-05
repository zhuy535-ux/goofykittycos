import { Router } from 'express';
import { randomUUID as uuid } from 'node:crypto';
import { db } from '../db/index.js';
import { emitToUser } from '../services/realtime.js';

export const notesRouter = Router();

// --- Private "Work Remarks" — visible only to creator -------------------
notesRouter.get('/remarks', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json([]);
  res.json(
    db.prepare('SELECT * FROM work_remarks WHERE user_id = ? ORDER BY created_at DESC').all(user_id)
  );
});

notesRouter.post('/remarks', (req, res) => {
  const { user_id, body, event_id } = req.body || {};
  if (!user_id || !body) return res.status(400).json({ error: 'user_id and body required' });
  const id = uuid();
  db.prepare(
    'INSERT INTO work_remarks (id, user_id, body, event_id) VALUES (?, ?, ?, ?)'
  ).run(id, user_id, body, event_id || null);
  res.json(db.prepare('SELECT * FROM work_remarks WHERE id = ?').get(id));
});

notesRouter.delete('/remarks/:id', (req, res) => {
  db.prepare('DELETE FROM work_remarks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Shared team notes ---------------------------------------------------
notesRouter.get('/team', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json([]);
  res.json(
    db
      .prepare(
        `SELECT n.*, fu.display_name AS from_name, fu.email AS from_email,
                tu.display_name AS to_name,   tu.email AS to_email
         FROM team_notes n
         JOIN users fu ON fu.id = n.from_user_id
         JOIN users tu ON tu.id = n.to_user_id
         WHERE n.from_user_id = ? OR n.to_user_id = ?
         ORDER BY n.created_at DESC`
      )
      .all(user_id, user_id)
  );
});

notesRouter.post('/team', (req, res) => {
  const { from_user_id, to_user_id, body } = req.body || {};
  if (!from_user_id || !to_user_id || !body) {
    return res.status(400).json({ error: 'from_user_id, to_user_id, body required' });
  }
  const id = uuid();
  db.prepare(
    'INSERT INTO team_notes (id, from_user_id, to_user_id, body) VALUES (?, ?, ?, ?)'
  ).run(id, from_user_id, to_user_id, body);

  // Priority 2 notification.
  const notifId = uuid();
  db.prepare(
    `INSERT INTO notifications (id, user_id, kind, payload)
     VALUES (?, ?, 'peer_note', ?)`
  ).run(notifId, to_user_id, JSON.stringify({ team_note_id: id }));

  emitToUser(req.app.get('io'), to_user_id, 'team_note:new', { id });
  res.json(db.prepare('SELECT * FROM team_notes WHERE id = ?').get(id));
});

notesRouter.post('/team/:id/read', (req, res) => {
  db.prepare('UPDATE team_notes SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Bookmarks (structured links) ---------------------------------------
notesRouter.get('/bookmarks', (req, res) => {
  const { user_id, event_id } = req.query;
  if (!user_id) return res.json([]);
  if (event_id) {
    return res.json(
      db
        .prepare('SELECT * FROM bookmarks WHERE user_id = ? AND event_id = ? ORDER BY created_at DESC')
        .all(user_id, event_id)
    );
  }
  res.json(
    db.prepare('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC').all(user_id)
  );
});

notesRouter.post('/bookmarks', (req, res) => {
  const { user_id, event_id, link_name, url } = req.body || {};
  if (!user_id || !link_name || !url) {
    return res.status(400).json({ error: 'user_id, link_name, url required' });
  }
  try {
    // Enforce a real URL.
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'url must be a valid URL' });
  }
  if (!String(link_name).trim()) {
    return res.status(400).json({ error: 'link_name cannot be empty' });
  }
  const id = uuid();
  db.prepare(
    'INSERT INTO bookmarks (id, user_id, event_id, link_name, url) VALUES (?, ?, ?, ?, ?)'
  ).run(id, user_id, event_id || null, link_name.trim(), url);
  res.json(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
});

notesRouter.delete('/bookmarks/:id', (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
