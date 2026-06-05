import { Router } from 'express';
import { randomUUID as uuid } from 'node:crypto';
import { db } from '../db/index.js';
import { sendTeamInviteEmail } from '../services/email.js';
import { requireAuth } from '../services/jwt.js';

export const usersRouter = Router();

/**
 * Returns the caller's organization_id, used to enforce tenant isolation.
 * If the caller has no org (legacy data) we return null and downstream
 * routes will reject the request rather than leak cross-tenant data.
 */
function callerOrg(req) {
  if (!req.user_id) return null;
  const row = db.prepare('SELECT organization_id, role FROM users WHERE id = ?').get(req.user_id);
  return row || null;
}

// ----- LIST USERS — isolated to caller's organization --------------------
usersRouter.get('/', requireAuth, (req, res) => {
  const me = callerOrg(req);
  if (!me?.organization_id) return res.json([]);
  res.json(
    db
      .prepare(
        `SELECT id, organization_id, role, email, username, display_name, timezone, sleep_start, sleep_end
         FROM users
         WHERE organization_id = ?
         ORDER BY display_name`
      )
      .all(me.organization_id)
  );
});

// ----- GET ONE USER — only if same org -----------------------------------
usersRouter.get('/:id', requireAuth, (req, res) => {
  const me = callerOrg(req);
  if (!me?.organization_id) return res.status(404).json({ error: 'Not found' });
  const u = db
    .prepare('SELECT * FROM users WHERE id = ? AND organization_id = ?')
    .get(req.params.id, me.organization_id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  delete u.password_hash;
  res.json(u);
});

// ----- PATCH USER PROFILE — self only ------------------------------------
usersRouter.patch('/:id', requireAuth, (req, res) => {
  if (req.user_id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
  // Username is intentionally immutable.
  const allowed = ['email', 'display_name', 'timezone', 'sleep_start', 'sleep_end'];
  if ('username' in req.body) return res.status(400).json({ error: 'Username is immutable.' });
  if ('role' in req.body)     return res.status(400).json({ error: 'Role cannot be set this way.' });
  if ('organization_id' in req.body) return res.status(400).json({ error: 'Organization cannot be changed.' });
  const fields = []; const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
  }
  if (fields.length) {
    values.push(req.params.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  delete u.password_hash;
  res.json(u);
});

// ----- DELETE TEAMMATE — admin of the same org only ----------------------
usersRouter.delete('/:id', requireAuth, (req, res) => {
  const me = callerOrg(req);
  if (!me?.organization_id) return res.status(403).json({ error: 'Forbidden' });
  if (me.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  if (req.params.id === req.user_id) return res.status(400).json({ error: 'You cannot remove yourself.' });
  const target = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(req.params.id);
  if (!target || target.organization_id !== me.organization_id) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ----- EMAIL-INVITE A NEW TEAMMATE TO MY ORG -----------------------------
usersRouter.post('/invite', requireAuth, async (req, res) => {
  const { email, displayName } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const me = callerOrg(req);
  if (!me?.organization_id) return res.status(400).json({ error: 'No organization' });

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const id = uuid();
    const base = (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';
    let candidate = base; let n = 0;
    while (db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(candidate)) {
      n++; candidate = `${base}${n}`;
    }
    db.prepare(
      `INSERT INTO users (id, organization_id, role, email, username, display_name, timezone)
       VALUES (?, ?, 'member', ?, ?, ?, 'UTC')`
    ).run(id, me.organization_id, email, candidate, displayName || candidate);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (user.organization_id && user.organization_id !== me.organization_id) {
    return res.status(409).json({ error: 'That email is already on another workspace.' });
  } else if (!user.organization_id) {
    // Pre-existing user without an org → adopt them into ours.
    db.prepare('UPDATE users SET organization_id = ?, role = COALESCE(role, "member") WHERE id = ?')
      .run(me.organization_id, user.id);
  }
  const fromUser = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user_id);
  await sendTeamInviteEmail({ to: email, fromEmail: fromUser?.email });
  delete user.password_hash;
  res.json({ user });
});
