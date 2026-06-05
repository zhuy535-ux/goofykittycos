import { Router } from 'express';
import { randomUUID as uuid } from 'node:crypto';
import { db } from '../db/index.js';
import { requireAuth } from '../services/jwt.js';

export const eventsRouter = Router();

const FIELDS = [
  'title', 'start_iso', 'end_iso', 'timezone', 'category',
  'notes', 'alarm_iso', 'location', 'meeting_link', 'meeting_provider',
  'recurrence', 'availability_status'
];

function callerOrg(req) {
  if (!req.user_id) return null;
  return db.prepare('SELECT organization_id FROM users WHERE id = ?').get(req.user_id);
}

// Keyword search — only over caller's organization.
eventsRouter.get('/search', requireAuth, (req, res) => {
  const me = callerOrg(req);
  const { q } = req.query;
  if (!me?.organization_id || !q) return res.json([]);
  const like = `%${String(q).toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT e.* FROM events e
       JOIN users u ON u.id = e.user_id
       WHERE u.organization_id = ?
         AND e.user_id = ?
         AND (LOWER(e.title) LIKE ?
              OR LOWER(IFNULL(e.notes,'')) LIKE ?
              OR LOWER(IFNULL(e.location,'')) LIKE ?
              OR LOWER(e.category) LIKE ?)
       ORDER BY e.start_iso DESC
       LIMIT 25`
    )
    .all(me.organization_id, req.user_id, like, like, like, like);
  res.json(rows);
});

// LIST EVENTS — strictly within the caller's org.
eventsRouter.get('/', requireAuth, (req, res) => {
  const me = callerOrg(req);
  if (!me?.organization_id) return res.json([]);
  const { user_id, user_ids } = req.query;

  if (user_ids) {
    const ids = String(user_ids).split(',').filter(Boolean);
    if (!ids.length) return res.json([]);
    // Verify every requested user is in the caller's org.
    const placeholders = ids.map(() => '?').join(',');
    const valid = db
      .prepare(`SELECT id FROM users WHERE organization_id = ? AND id IN (${placeholders})`)
      .all(me.organization_id, ...ids)
      .map((r) => r.id);
    if (!valid.length) return res.json([]);
    const vp = valid.map(() => '?').join(',');
    return res.json(
      db.prepare(`SELECT * FROM events WHERE user_id IN (${vp}) ORDER BY start_iso`).all(...valid)
    );
  }
  if (user_id) {
    const owner = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(user_id);
    if (!owner || owner.organization_id !== me.organization_id) return res.json([]);
    return res.json(
      db.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY start_iso').all(user_id)
    );
  }
  res.json(
    db
      .prepare(
        `SELECT e.* FROM events e
         JOIN users u ON u.id = e.user_id
         WHERE u.organization_id = ?
         ORDER BY e.start_iso`
      )
      .all(me.organization_id)
  );
});

eventsRouter.post('/', requireAuth, (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const me = callerOrg(req);
  if (!me?.organization_id) return res.status(403).json({ error: 'No organization' });

  // You can only create events for yourself (no impersonation).
  if (user_id !== req.user_id) {
    return res.status(403).json({ error: 'You can only create events for yourself.' });
  }
  if (!req.body.start_iso || !req.body.end_iso) {
    return res.status(400).json({ error: 'start_iso and end_iso required' });
  }
  if (new Date(req.body.end_iso) <= new Date(req.body.start_iso)) {
    return res.status(400).json({ error: 'end_iso must be after start_iso' });
  }

  const id = uuid();
  const row = {
    id, user_id, organization_id: me.organization_id,
    title: req.body.title || 'Untitled',
    start_iso: req.body.start_iso,
    end_iso: req.body.end_iso,
    timezone: req.body.timezone || 'UTC',
    category: req.body.category || 'Other',
    notes: req.body.notes || null,
    alarm_iso: req.body.alarm_iso || null,
    location: req.body.location || null,
    meeting_link: req.body.meeting_link || null,
    meeting_provider: req.body.meeting_provider || null,
    recurrence: req.body.recurrence || 'None',
    availability_status: req.body.availability_status || 'red',
  };
  db.prepare(
    `INSERT INTO events (id, user_id, organization_id, ${FIELDS.join(', ')})
     VALUES (@id, @user_id, @organization_id, ${FIELDS.map((f) => '@' + f).join(', ')})`
  ).run(row);
  const created = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  req.app.get('io').emit('event:created', created);
  res.json(created);
});

eventsRouter.patch('/:id', requireAuth, (req, res) => {
  const me = callerOrg(req);
  const target = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.user_id !== req.user_id) return res.status(403).json({ error: 'Forbidden' });
  if (target.organization_id && target.organization_id !== me?.organization_id) {
    return res.status(404).json({ error: 'Not found' });
  }

  const sets = []; const values = [];
  for (const f of FIELDS) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    values.push(req.params.id);
    db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  req.app.get('io').emit('event:updated', updated);
  res.json(updated);
});

eventsRouter.delete('/:id', requireAuth, (req, res) => {
  const me = callerOrg(req);
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.json({ ok: true });
  if (ev.user_id !== req.user_id) return res.status(403).json({ error: 'Forbidden' });
  if (ev.organization_id && ev.organization_id !== me?.organization_id) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  req.app.get('io').emit('event:deleted', { id: ev.id, user_id: ev.user_id });
  res.json({ ok: true });
});
