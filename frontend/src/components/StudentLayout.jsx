import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const ICONS = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  performance: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  practice: 'M12 2l2.6 6.4L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.6z',
  reports: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
};
const Icon = ({ name }) => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
);

const LINKS = [
  ['/student', 'Dashboard', 'dashboard', true],
  ['/student/performance', 'Performance', 'performance'],
  ['/student/practice', 'Practice', 'practice'],
  ['/student/reports', 'Reports', 'reports'],
  ['/student/settings', 'Settings', 'settings'],
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/student" className="brand side-brand">AI Assessment</Link>
        <nav aria-label="Student navigation">
          {LINKS.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'side-link on' : 'side-link')}>
              <Icon name={icon} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-user"><strong>{user.name}</strong><span>{user.email}</span></div>
          <button className="btn ghost light" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="shell-main"><div className="container"><Outlet /></div></main>
      <nav className="bottom-nav" aria-label="Student navigation">
        {LINKS.map(([to, label, icon, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'bn-link on' : 'bn-link')}>
            <Icon name={icon} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
