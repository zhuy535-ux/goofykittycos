import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../data.sqlite');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ------------------------------------------------------------------
// Multi-tenant schema. organizations is the tenant boundary; every
// data-bearing row is reachable from exactly one organization.
// ------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    invitation_code TEXT NOT NULL UNIQUE,
    created_by      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
    email           TEXT UNIQUE NOT NULL,
    username        TEXT UNIQUE,
    display_name    TEXT,
    password_hash   TEXT,
    timezone        TEXT NOT NULL DEFAULT 'UTC',
    sleep_start     INTEGER NOT NULL DEFAULT 0,
    sleep_end       INTEGER NOT NULL DEFAULT 8,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id     TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    start_iso           TEXT NOT NULL,
    end_iso             TEXT NOT NULL,
    timezone            TEXT NOT NULL,
    category            TEXT NOT NULL DEFAULT 'Other',
    notes               TEXT,
    alarm_iso           TEXT,
    location            TEXT,
    meeting_link        TEXT,
    meeting_provider    TEXT,
    recurrence          TEXT NOT NULL DEFAULT 'None',
    availability_status TEXT NOT NULL DEFAULT 'red',
    alarm_fired         INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id              TEXT PRIMARY KEY,
    event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    from_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    message         TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL,
    payload      TEXT NOT NULL,
    read         INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS work_remarks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS team_notes (
    id           TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    read         INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,
    due_iso     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    icon_id     TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    TEXT REFERENCES events(id) ON DELETE CASCADE,
    link_name   TEXT NOT NULL,
    url         TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Soft migrations for installs that predate columns introduced above.
// These are no-ops on a fresh DB (the columns are already present) but
// keep existing dev databases working without a hard reset.
function addColIfMissing(table, ddl) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* already exists */ }
}
addColIfMissing('users',  'organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE');
addColIfMissing('users',  `role TEXT NOT NULL DEFAULT 'member'`);
addColIfMissing('users',  'username TEXT');
addColIfMissing('users',  'password_hash TEXT');
addColIfMissing('events', 'organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE');
addColIfMissing('events', 'alarm_fired INTEGER NOT NULL DEFAULT 0');

// Helper used by the auth flow.
export function generateInvitationCode() {
  // Format: ENTJ-AAAA-BBB  (avoiding ambiguous chars 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `ENTJ-${pick(4)}-${pick(3)}`;
}
