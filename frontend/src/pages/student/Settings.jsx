import { useState } from 'react';
import { api, setToken } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Alert, Card, useAction, useUI } from '../../components/ui.jsx';

function Profile() {
  const { user, updateUser } = useAuth();
  const { toast } = useUI();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const act = useAction();
  const emailChanged = email.trim().toLowerCase() !== user.email;

  const save = (e) => {
    e.preventDefault();
    act.run(async () => {
      const d = await api.patch('/account/profile', { name, email, ...(emailChanged ? { password } : {}) });
      updateUser(d.user); setPassword(''); toast('Profile updated');
    });
  };
  return (
    <Card title="Profile">
      <form className="stack" onSubmit={save}>
        <label>Full name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {emailChanged && <label>Current password (required to change email)<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        <Alert>{act.error}</Alert>
        <div><button className="btn" disabled={act.busy}>{act.busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </Card>
  );
}

function Password() {
  const { toast } = useUI();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const act = useAction();
  const save = (e) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return act.setError('The new passwords do not match.');
    act.run(async () => {
      const d = await api.post('/account/password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      setToken(d.token); // older sessions on other devices are now invalid
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password changed');
    });
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Change password">
      <form className="stack" onSubmit={save}>
        <label>Current password<input type="password" required autoComplete="current-password" value={f.currentPassword} onChange={set('currentPassword')} /></label>
        <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={f.newPassword} onChange={set('newPassword')} /></label>
        <label>Confirm new password<input type="password" required autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></label>
        <p className="muted small">At least 8 characters, with a letter and a number. Changing your password signs you out on other devices.</p>
        <Alert>{act.error}</Alert>
        <div><button className="btn" disabled={act.busy}>{act.busy ? 'Updating…' : 'Update password'}</button></div>
      </form>
    </Card>
  );
}

const PREFS = [
  ['emailOnResult', 'Email me when I finish an assessment'],
  ['weeklySummary', 'Weekly progress summary'],
  ['practiceReminders', 'Practice reminders'],
];

function Notifications() {
  const { user, updateUser } = useAuth();
  const { toast } = useUI();
  const act = useAction();
  const toggle = (k) => act.run(async () => {
    const d = await api.patch('/account/preferences', { [k]: !user.preferences?.[k] });
    updateUser({ preferences: d.preferences }); toast('Preference saved');
  });
  return (
    <Card title="Notification preferences">
      {PREFS.map(([k, label]) => (
        <label key={k} className="check"><input type="checkbox" checked={!!user.preferences?.[k]} disabled={act.busy} onChange={() => toggle(k)} />{label}</label>
      ))}
      <p className="muted small">Your choices are saved, but this version of the platform does not send emails yet.</p>
      <Alert>{act.error}</Alert>
    </Card>
  );
}

function Account() {
  const { logout } = useAuth();
  const { confirm, toast } = useUI();
  const [password, setPassword] = useState('');
  const act = useAction();
  const remove = async () => {
    const ok = await confirm({ title: 'Delete your account?', message: 'This permanently deletes your account, practice tests, attempts and reports. This cannot be undone.', confirmText: 'Delete account', danger: true });
    if (!ok) return;
    act.run(async () => { await api.del('/account', { password }); toast('Account deleted'); logout(); });
  };
  return (
    <Card title="Account">
      <div className="row between"><span>Sign out of this device</span><button className="btn ghost" onClick={logout}>Log out</button></div>
      <hr />
      <h4>Delete account</h4>
      <label>Enter your password to confirm<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <Alert>{act.error}</Alert>
      <div><button className="btn ghost danger" disabled={!password || act.busy} onClick={remove}>Delete my account</button></div>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="stack">
      <h2>Settings</h2>
      <div className="grid"><Profile /><Password /></div>
      <div className="grid"><Notifications /><Account /></div>
    </div>
  );
}
