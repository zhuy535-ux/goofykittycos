import { Router } from 'express';
import { db, generateInvitationCode } from '../db/index.js';
import { requireAuth } from '../services/jwt.js';

export const organizationsRouter = Router();

function uniqueCode() {
  for (let i = 0; i < 12; i++) {
    const code = generateInvitationCode();
    if (!db.prepare('SELECT 1 FROM organizations WHERE invitation_code = ?').get(code)) return code;
  }
  throw new Error('Could not generate a unique invitation code');
}

function requireAdmin(req, res, next) {
  const u = db.prepare('SELECT role, organization_id FROM users WHERE id = ?').get(req.user_id);
  if (!u) return res.status(401).json({ error: 'unauthenticated' });
  if (u.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  req.org_id = u.organization_id;
  next();
}

// The current user's own org.
organizationsRouter.get('/me', requireAuth, (req, res) => {
  const u = db.prepare('SELECT organization_id, role FROM users WHERE id = ?').get(req.user_id);
  if (!u?.organization_id) return res.json({ organization: null, role: null });
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(u.organization_id);
  // Members do not see the invitation code (security: code rotates to revoke access).
  if (u.role !== 'admin' && org) delete org.invitation_code;
  res.json({ organization: org, role: u.role });
});

// Regenerate the invitation code — admin only.
organizationsRouter.post('/regenerate-code', requireAuth, requireAdmin, (req, res) => {
  const code = uniqueCode();
  db.prepare('UPDATE organizations SET invitation_code = ? WHERE id = ?').run(code, req.org_id);
  res.json({ invitation_code: code });
});
