import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useUI } from '../store/ui';
import { useAuth } from '../store/auth';
import { useApps } from '../store/applications';
import { renderIcon } from './AppIcons';
import AddApplicationModal from './AddApplicationModal';

export default function Sidebar() {
  const badge = useUI((s) => s.notificationBadge);
  const user = useAuth((s) => s.user);
  const apps = useApps((s) => s.items);
  const loadApps = useApps((s) => s.load);
  const removeApp = useApps((s) => s.remove);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { if (user) loadApps(user.id); }, [user, loadApps]);

  return (
    <nav className="sidebar">
      <div className="section-title">Workspace</div>
      <NavLink to="/workspace/settings"><Icon><CogIcon/></Icon> Settings</NavLink>
      <NavLink to="/workspace/todos"><Icon><CheckIcon/></Icon> To-Do List</NavLink>
      <NavLink to="/workspace/notifications">
        <Icon><BellIcon/></Icon> Notifications
        {badge > 0 && <span className="badge">{badge}</span>}
      </NavLink>
      <NavLink to="/workspace/team"><Icon><PeopleIcon/></Icon> Teammates</NavLink>

      <div className="section-title">Notes</div>
      <NavLink to="/workspace/remarks"><Icon><PencilIcon/></Icon> Work Remarks</NavLink>
      <NavLink to="/workspace/notes"><Icon><ChatIcon/></Icon> Team Notes</NavLink>

      <div className="section-title">Quick Links</div>
      <a
        href="https://drive.google.com/drive/folders/1RWEByJM_P4lKFQTy-73iJSTE6SPedivr?usp=share_link"
        target="_blank"
        rel="noreferrer"
      >
        <Icon><DriveIcon/></Icon> Google Workspace
      </a>

      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Applications</span>
        <button
          className="ghost"
          style={{ padding: '2px 6px', fontSize: 11 }}
          onClick={() => setAddOpen(true)}
          title="Add application"
        >
          +
        </button>
      </div>
      {apps.length === 0 && (
        <div style={{ padding: '0 16px 8px', fontSize: 11, color: 'var(--text-faint)' }}>
          Tap + to link Slack, Notion, GitHub, etc.
        </div>
      )}
      {apps.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          onContextMenu={(e) => {
            e.preventDefault();
            if (confirm(`Remove "${a.name}" from sidebar?`)) removeApp(a.id);
          }}
          title={a.name + '  ·  right-click to remove'}
        >
          <Icon>{renderIcon(a.icon_id, 16)}</Icon> {a.name}
        </a>
      ))}

      {addOpen && (
        <AddApplicationModal
          onClose={() => setAddOpen(false)}
          onSaved={() => user && loadApps(user.id)}
        />
      )}
    </nav>
  );
}

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span style={{ width: 18, height: 18, display: 'inline-grid', placeItems: 'center', color: 'currentColor' }}>
    {children}
  </span>
);

const CogIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
const CheckIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>);
const BellIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>);
const PeopleIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><path d="M14 20c0-2 2-3.5 4-3.5"/></svg>);
const PencilIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>);
const ChatIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
const DriveIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4h8l5 9-3 7H6L3 13z"/><path d="M8 4l4 9M16 4l-4 9M3 13h18"/></svg>);
