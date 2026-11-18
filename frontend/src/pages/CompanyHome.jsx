import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Card, Tabs, useAction } from '../components/ui.jsx';
import TestsPanel from '../components/TestsPanel.jsx';

function JobRoles() {
  const [roles, setRoles] = useState([]);
  const [roleName, setRoleName] = useState('');
  const act = useAction();
  const load = useCallback(() => api.get('/jobroles').then((d) => setRoles(d.jobRoles)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const create = (e) => {
    e.preventDefault();
    act.run(async () => { await api.post('/jobroles', { roleName }); setRoleName(''); load(); });
  };

  return (
    <Card title="Job roles">
      <form className="row" onSubmit={create}>
        <input className="grow" required placeholder="e.g. Backend Developer" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
        <button className="btn" disabled={act.busy}>Create role</button>
      </form>
      <Alert>{act.error}</Alert>
      <ul className="list">
        {roles.map((r) => (
          <li key={r._id}>
            <div><strong>{r.roleName}</strong><div className="muted small">{r.invitedEmails.length} invited · {r.testIds.length} tests</div></div>
            <Link className="btn ghost" to={`/company/roles/${r._id}`}>Open</Link>
          </li>
        ))}
        {roles.length === 0 && <p className="muted">No job roles yet.</p>}
      </ul>
    </Card>
  );
}

export default function CompanyHome() {
  return (
    <Tabs tabs={['Job roles', 'Screening tests']}>
      {(t) => (t === 'Job roles' ? <JobRoles /> : <TestsPanel />)}
    </Tabs>
  );
}
