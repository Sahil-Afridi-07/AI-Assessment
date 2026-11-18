import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const LABEL = { student: 'Student', teacher: 'Teacher', company: 'Company' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="nav">
        <Link to={`/${user.role}`} className="brand">AI Assessment Platform</Link>
        <div className="nav-right">
          <span className="chip">{LABEL[user.role]}</span>
          <span className="muted">{user.name}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
