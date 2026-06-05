# Shared Calendar

Real-time scheduling and collaboration tool for small teams. Built as a desktop-deployable
PWA (works in any modern browser; bundled Electron wrapper available for true desktop install).

## Stack

| Layer        | Tech                                                  |
| ------------ | ----------------------------------------------------- |
| Frontend     | React 18 + Vite + TypeScript + Zustand                |
| Backend      | Node.js + Express + better-sqlite3 + Socket.IO        |
| Realtime     | Socket.IO (invitation pop-ups, presence)              |
| Desktop      | Electron wrapper + PWA manifest                       |
| Auth (stub)  | Email-only login; Google Workspace OAuth placeholder  |

## One-time setup

```bash
npm install                  # root deps (concurrently, wait-on)
npm install --prefix backend
npm install --prefix frontend
npm install --prefix electron     # optional, only if you want desktop window
```

Or, all at once:

```bash
npm run install:all
```

## Develop

```bash
npm run dev                  # backend on :4000, frontend on :5173
npm run dev:electron         # same, plus an Electron window
```

Open <http://localhost:5173>.

## Deploying to a custom domain

The frontend is a static SPA — drop the `frontend/dist/` build behind any host
and point your domain at it. The backend can run on the same machine; set
`VITE_API_BASE` in `frontend/.env.production` to your API URL before building.

The PWA manifest (`frontend/public/manifest.webmanifest`) lets users
"Install" the app from Chrome / Edge so it opens in its own window —
no Electron required.

## Architecture

```
backend/
  src/
    server.js            # Express + Socket.IO bootstrap
    db/                  # SQLite schema + connection
    routes/              # REST endpoints
    services/            # email (mock), realtime helpers
frontend/
  src/
    App.tsx              # TopBar + Sidebar + <Outlet/>
    pages/               # one per route
    components/          # Calendar grids, modals, popups
    store/               # Zustand stores (auth, ui, socket)
    api/                 # fetch wrappers
electron/
  main.js                # window wrapper
```

## Implementation notes

- Email delivery is **stubbed** — invitations log to the backend console
  in the shape `EMAIL → recipient@x.com: ...`. Swap `backend/src/services/email.js`
  for a real provider (SES, Postmark, Resend) when ready.
- Google Workspace OAuth is **not** wired — the sidebar shortcut opens
  `https://workspace.google.com` for now. Place real client/secret in
  `backend/.env` and add the redirect handler in `backend/src/routes/auth.js`.
- DB file lives at `backend/data.sqlite`. Delete it to reset state.
