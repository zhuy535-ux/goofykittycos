import { Router } from 'express';
import { randomUUID as uuid } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, generateInvitationCode } from '../db/index.js';
import { signToken } from '../services/jwt.js';

export const authRouter = Router();

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{1,23}$/;
const ORG_NAME_RE = /^.{2,80}$/;
const CODE_RE     = /^[A-Z0-9-]{6,32}$/;

function uniqueInvitationCode() {
  for (let i = 0; i < 12; i++) {
    const code = generateInvitationCode();
    if (!db.prepare('SELECT 1 FROM organizations WHERE invitation_code = ?').get(code)) return code;
  }
  throw new Error('Could not generate a unique invitation code');
}

authRouter.post('/signup', async (req, res) => {
  const { email, username, password, displayName, timezone, mode, orgName, invitationCode } = req.body || {};

  if (!email || !/^.+@.+\..+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 2–24 chars, start with a letter, letters/digits/_ only.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (mode !== 'create_org' && mode !== 'join_org') {
    return res.status(400).json({ error: 'mode must be create_org or join_org.' });
  }

  // Resolve organization first so we can fail before creating any user.
  let organization;
  let role;
  if (mode === 'create_org') {
    if (!orgName || !ORG_NAME_RE.test(orgName.trim())) {
      return res.status(400).json({ error: 'Workspace name must be 2–80 characters.' });
    }
    // Defer org creation until after we've checked email/username are free.
    role = 'admin';
  } else {
    if (!invitationCode || !CODE_RE.test(invitationCode.trim().toUpperCase())) {
      return res.status(400).json({ error: 'Invitation code looks malformed.' });
    }
    organization = db
      .prepare('SELECT * FROM organizations WHERE invitation_code = ?')
      .get(invitationCode.trim().toUpperCase());
    if (!organization) return res.status(404).json({ error: 'Invitation code not found.' });
    role = 'member';
  }

  // Uniqueness checks.
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email already registered. Sign in instead.' });
  }
  if (db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(username)) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const userId = uuid();
  const hash = await bcrypt.hash(password, 10);

  // For create_org we now also create the organization. Both writes go in a
  // single transaction so a half-state can't leak (e.g. user without org).
  const insert = db.transaction(() => {
    if (mode === 'create_org') {
      const orgId = uuid();
      const code = uniqueInvitationCode();
      db.prepare(
        `INSERT INTO organizations (id, name, invitation_code, created_by) VALUES (?, ?, ?, ?)`
      ).run(orgId, orgName.trim(), code, userId);
      organization = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
    }
    db.prepare(
      `INSERT INTO users (id, organization_id, role, email, username, display_name, password_hash, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, organization.id, role, email, username, displayName || username, hash, timezone || 'UTC');
  });
  insert();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  // Members never see the code in API responses.
  const orgForResponse = role === 'admin' ? organization : { ...organization, invitation_code: undefined };
  res.json({ user: publicUser(user), organization: orgForResponse, token: signToken(userId) });
});

authRouter.post('/signin', async (req, res) => {
  const { emailOrUsername, password } = req.body || {};
  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: 'Email/username and password are required.' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE email = ? OR username = ? COLLATE NOCASE')
    .get(emailOrUsername, emailOrUsername);

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

  if (req.body.timezone && req.body.timezone !== user.timezone) {
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(req.body.timezone, user.id);
    user.timezone = req.body.timezone;
  }
  const org = user.organization_id
    ? db.prepare('SELECT * FROM organizations WHERE id = ?').get(user.organization_id)
    : null;
  const orgForResponse = (user.role === 'admin' && org) ? org : org ? { ...org, invitation_code: undefined } : null;
  res.json({ user: publicUser(user), organization: orgForResponse, token: signToken(user.id) });
});

// Always include the current user's org alongside their profile.
authRouter.get('/me', (req, res) => {
  if (!req.user_id) return res.status(401).json({ error: 'unauthenticated' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user_id);
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  const org = user.organization_id
    ? db.prepare('SELECT * FROM organizations WHERE id = ?').get(user.organization_id)
    : null;
  const orgForResponse = (user.role === 'admin' && org) ? org : org ? { ...org, invitation_code: undefined } : null;
  res.json({ user: publicUser(user), organization: orgForResponse });
});
