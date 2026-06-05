import jwt from 'jsonwebtoken';

// In a real deployment this comes from env. The dev fallback keeps things
// usable but logs a warning so it can't accidentally ship.
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod';
if (SECRET === 'dev-only-secret-do-not-use-in-prod') {
  console.warn('[backend] ⚠ Using dev JWT secret. Set JWT_SECRET in production.');
}

export const TOKEN_TTL = '30d';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

// Express middleware that fills req.user_id from Authorization: Bearer <jwt>.
// Routes can choose to require it via `requireAuth`.
export function attachUser(req, _res, next) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (m) {
    const payload = verifyToken(m[1]);
    if (payload?.sub) req.user_id = payload.sub;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user_id) return res.status(401).json({ error: 'Authentication required' });
  next();
}
