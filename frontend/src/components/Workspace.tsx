import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import LaunchPopup from './LaunchPopup';
import IncomingInvitationToast from './IncomingInvitationToast';
import AlarmDispatcher from './AlarmDispatcher';
import PersonalCalendar from '../pages/PersonalCalendar';
import CompositeCalendarPage from '../pages/CompositeCalendarPage';
import Settings from '../pages/Settings';
import Todos from '../pages/Todos';
import Notifications from '../pages/Notifications';
import WorkRemarks from '../pages/WorkRemarks';
import TeamNotes from '../pages/TeamNotes';
import Teammates from '../pages/Teammates';
import { useAuth } from '../store/auth';
import { useSocket } from '../store/socket';
import { useUI } from '../store/ui';
import { api, ApiError } from '../api/client';
import { toastInfo } from '../store/toast';
import type { Notification } from '../types';

export default function Workspace() {
  const user = useAuth((s) => s.user);
  const connectSocket = useSocket((s) => s.connect);
  const setBadge = useUI((s) => s.setNotificationBadge);
  const setShowLaunch = useUI((s) => s.setShowLaunchPopup);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await api.get(`/users/${user.id}`);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401 || e.status === 409)) {
          useAuth.getState().logout();
          toastInfo('Session expired', 'Please sign in again.');
          return;
        }
      }
      connectSocket(user.id);
      try {
        const list = await api.get<Notification[]>(`/notifications?user_id=${user.id}`);
        const unread = list.filter((n) => !n.read);
        setBadge(unread.length);
        const hasPriority =
          unread.some((n) => n.kind === 'invitation') ||
          unread.some((n) => n.kind === 'peer_note');
        if (hasPriority) setShowLaunch(true);
      } catch { /* non-fatal */ }
    })();
  }, [user, connectSocket, setBadge, setShowLaunch]);

  if (!user) return <Navigate to="/signin" replace />;

  return (
    <div className="app-shell">
      <TopBar />
      <Sidebar />
      <main className="main">
        <Routes>
          <Route index element={<Navigate to="calendar" replace />} />
          <Route path="calendar" element={<PersonalCalendar />} />
          <Route path="composite" element={<CompositeCalendarPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="todos" element={<Todos />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="remarks" element={<WorkRemarks />} />
          <Route path="notes" element={<TeamNotes />} />
          <Route path="team" element={<Teammates />} />
          <Route path="*" element={<Navigate to="calendar" replace />} />
        </Routes>
      </main>
      <LaunchPopup onJump={(path) => navigate(path)} />
      <IncomingInvitationToast />
      <AlarmDispatcher />
    </div>
  );
}
