import { Router } from 'express';
import { randomUUID as uuid } from 'node:crypto';
import { db } from '../db/index.js';
import { sendInvitationEmail } from '../services/email.js';
import { isOnline, emitToUser } from '../services/realtime.js';

export const invitationsRouter = Router();

invitationsRouter.get('/', (req, res) => {
  const { user_id, status } = req.query;
  if (!user_id) return res.json([]);
  const where = ['to_user_id = ?'];
  const params = [user_id];
  if (status) { where.push('status = ?'); params.push(status); }
  const rows = db.prepare(
    `SELECT i.*, e.title AS event_title, e.start_iso, e.end_iso,
            u.email AS from_email, u.display_name AS from_name
     FROM invitations i
     JOIN events e ON e.id = i.event_id
     JOIN users  u ON u.id = i.from_user_id
     WHERE ${where.join(' AND ')}
     ORDER BY i.created_at DESC`
  ).all(...params);
  res.json(rows);
});

invitationsRouter.post('/', (req, res) => {
  const { event_id, from_user_id, to_user_id, message } = req.body || {};
  if (!event_id || !from_user_id || !to_user_id) {
    return res.status(400).json({ error: 'event_id, from_user_id, to_user_id required' });
  }
  // Tenant isolation: both users must share an organization.
  const from = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(from_user_id);
  const to   = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(to_user_id);
  if (!from || !to) return res.status(404).json({ error: 'User not found.' });
  if (!from.organization_id || from.organization_id !== to.organization_id) {
    return res.status(403).json({ error: 'Cross-organization invitations are not allowed.' });
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO invitations (id, event_id, from_user_id, to_user_id, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, event_id, from_user_id, to_user_id, message || null);

  const inv = db.prepare(
    `SELECT i.*, e.title AS event_title, e.start_iso, e.end_iso, e.meeting_link,
            u.email AS from_email, u.display_name AS from_name
     FROM invitations i
     JOIN events e ON e.id = i.event_id
     JOIN users  u ON u.id = i.from_user_id
     WHERE i.id = ?`
  ).get(id);

  // Email is always fired.
  const recipient = db.prepare('SELECT email FROM users WHERE id = ?').get(to_user_id);
  if (recipient) {
    sendInvitationEmail({
      to: recipient.email,
      fromEmail: inv.from_email,
      eventTitle: inv.event_title,
      startIso: inv.start_iso,
      meetingLink: inv.meeting_link,
    });
  }

  // Notification record (priority 1).
  const notifId = uuid();
  db.prepare(
    `INSERT INTO notifications (id, user_id, kind, payload)
     VALUES (?, ?, 'invitation', ?)`
  ).run(notifId, to_user_id, JSON.stringify({ invitation_id: id }));

  const io = req.app.get('io');
  if (isOnline(to_user_id)) {
    emitToUser(io, to_user_id, 'invitation:incoming', inv);
  }
  // Sender gets confirmation event.
  emitToUser(io, from_user_id, 'invitation:sent', inv);

  res.json(inv);
});

invitationsRouter.post('/:id/respond', (req, res) => {
  const { decision } = req.body; // 'accepted' | 'rejected'
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be accepted or rejected' });
  }
  db.prepare('UPDATE invitations SET status = ? WHERE id = ?').run(decision, req.params.id);
  const inv = db.prepare('SELECT * FROM invitations WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'not found' });

  // Mark the corresponding invitation notification as read.
  db.prepare(
    `UPDATE notifications SET read = 1
     WHERE kind = 'invitation' AND user_id = ? AND payload LIKE ?`
  ).run(inv.to_user_id, `%${req.params.id}%`);

  // Notify the sender (no popup; badge-only).
  const notifId = uuid();
  db.prepare(
    `INSERT INTO notifications (id, user_id, kind, payload)
     VALUES (?, ?, 'general', ?)`
  ).run(notifId, inv.from_user_id, JSON.stringify({
    kind: 'invitation_response',
    invitation_id: inv.id,
    decision,
  }));

  emitToUser(req.app.get('io'), inv.from_user_id, 'invitation:responded', { invitation: inv });
  res.json(inv);
});
