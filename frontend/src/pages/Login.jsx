import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Alert, useAction } from '../components/ui.jsx';

const ROLES = [
  ['student', 'Student', 'Generate AI tests, practise and track progress'],
  ['teacher', 'Teacher', 'Create tests, manage classes, see analytics'],
  ['company', 'Company', 'Screen candidates with job-role tests'],
];

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    run(() => (mode === 'login' ? login(form.email, form.password) : register(form)));
  };

  return (
    <div className="auth-wrap">
      <form className="card auth" onSubmit={submit}>
        <h1>AI Assessment Platform</h1>
        <p className="muted">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</p>

        {mode === 'register' && (
          <>
            <label>Full name<input required value={form.name} onChange={set('name')} /></label>
            <div className="roles">
              {ROLES.map(([v, t, d]) => (
                <label key={v} className={form.role === v ? 'role on' : 'role'}>
                  <input type="radio" name="role" value={v} checked={form.role === v} onChange={set('role')} />
                  <strong>{t}</strong><span>{d}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
        <label>Password<input type="password" required minLength={6} value={form.password} onChange={set('password')} /></label>
        <Alert>{error}</Alert>
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
