import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import StudentLayout from './components/StudentLayout.jsx';
import Login from './pages/Login.jsx';
import Result from './pages/Result.jsx';
import TeacherHome from './pages/TeacherHome.jsx';
import ClassDetail from './pages/ClassDetail.jsx';
import CompanyHome from './pages/CompanyHome.jsx';
import JobRoleDetail from './pages/JobRoleDetail.jsx';
import Dashboard from './pages/student/Dashboard.jsx';
import Performance from './pages/student/Performance.jsx';
import Practice from './pages/student/Practice.jsx';
import Reports from './pages/student/Reports.jsx';
import Settings from './pages/student/Settings.jsx';
import StartTest from './pages/student/StartTest.jsx';
import Exam from './pages/student/Exam.jsx';

const HOME = { student: '/student', teacher: '/teacher', company: '/company' };

// Redirects unauthenticated users / wrong roles. `bare` renders children without any layout (exam screen).
function Guard({ role, bare, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={HOME[user.role]} replace />;
  return bare ? children : <Layout>{children}</Layout>;
}

function StudentShell() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student') return <Navigate to={HOME[user.role]} replace />;
  return <StudentLayout />;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={HOME[user.role]} replace /> : <Login />} />

      <Route path="/student" element={<StudentShell />}>
        <Route index element={<Dashboard />} />
        <Route path="performance" element={<Performance />} />
        <Route path="practice" element={<Practice />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/:id" element={<Result />} />
        <Route path="settings" element={<Settings />} />
        <Route path="start/:testId" element={<StartTest />} />
        {/* old links */}
        <Route path="test/:testId" element={<StartTest />} />
        <Route path="result/:id" element={<Result />} />
      </Route>
      <Route path="/student/exam/:attemptId" element={<Guard role="student" bare><Exam /></Guard>} />

      <Route path="/teacher" element={<Guard role="teacher"><TeacherHome /></Guard>} />
      <Route path="/teacher/classes/:id" element={<Guard role="teacher"><ClassDetail /></Guard>} />
      <Route path="/company" element={<Guard role="company"><CompanyHome /></Guard>} />
      <Route path="/company/roles/:id" element={<Guard role="company"><JobRoleDetail /></Guard>} />
      <Route path="/review/:id" element={<Guard><Result /></Guard>} />
      <Route path="*" element={loading ? null : <Navigate to={user ? HOME[user.role] : '/login'} replace />} />
    </Routes>
  );
}
