import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server as IOServer } from 'socket.io';

import './db/index.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { eventsRouter } from './routes/events.js';
import { invitationsRouter } from './routes/invitations.js';
import { notificationsRouter } from './routes/notifications.js';
import { notesRouter } from './routes/notes.js';
import { todosRouter } from './routes/todos.js';
import { applicationsRouter } from './routes/applications.js';
import { organizationsRouter } from './routes/organizations.js';
import { registerSocket, onlineUserIds } from './services/realtime.js';
import { attachUser } from './services/jwt.js';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
// Decode JWT (if present) and stash req.user_id for downstream routes.
app.use(attachUser);

// Concise per-request log: method, path, status, ms.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const tag = res.statusCode >= 500 ? '[backend] ✗' : res.statusCode >= 400 ? '[backend] ⚠' : '[backend] ·';
    console.log(`${tag} ${req.method} ${req.originalUrl} → ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, online: onlineUserIds() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/todos', todosRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/organizations', organizationsRouter);

// Global error handler — anything thrown (sync) or `next(err)`'d hits this,
// so 500s log a real stacktrace + the JSON the client sent.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, _next) => {
  console.error(`[backend] 500 ${req.method} ${req.originalUrl}\n`, err);
  if (req.body && Object.keys(req.body).length) {
    console.error('[backend] body:', JSON.stringify(req.body));
  }
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: '*' } });
app.set('io', io);

io.on('connection', (socket) => registerSocket(io, socket));

server.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
