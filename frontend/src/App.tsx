import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Workspace from './components/Workspace';
import ToastStack from './components/ToastStack';
import { useAuth } from './store/auth';

export default function App() {
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  // Validate persisted JWT once on boot — if it's expired, drop the session
  // before any page-level code tries to read it.
  useEffect(() => { hydrate().finally(() => setReady(true)); }, [hydrate]);

  if (!ready) {
    return (
      <div className="login-wrap">
        <div className="muted">Loading…</div>
        <ToastStack />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={user ? <Navigate to="/workspace/calendar" replace /> : <Login />} />
        <Route path="/workspace/*" element={<Workspace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastStack />
    </>
  );
}
