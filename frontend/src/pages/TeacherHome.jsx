import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Card, Tabs, useAction } from '../components/ui.jsx';
import TestsPanel from '../components/TestsPanel.jsx';

function Classes() {
  const [classes, setClasses] = useState([]);
  const [name, setName] = useState('');
  const act = useAction();
  const load = useCallback(() => api.get('/classes').then((d) => setClasses(d.classes)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const create = (e) => {
    e.preventDefault();
    act.run(async () => { await api.post('/classes', { name }); setName(''); load(); });
  };

  return (
    <Card title="Classes / Batches">
      <form className="row" onSubmit={create}>
        <input className="grow" required placeholder="New class name, e.g. MCA Sem 3 - Section A" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={act.busy}>Create class</button>
      </form>
      <Alert>{act.error}</Alert>
      <ul className="list">
        {classes.map((c) => (
          <li key={c._id}>
            <div><strong>{c.name}</strong><div className="muted small">{c.studentIds.length} students · {c.testIds.length} tests assigned</div></div>
            <Link className="btn ghost" to={`/teacher/classes/${c._id}`}>Open</Link>
          </li>
        ))}
        {classes.length === 0 && <p className="muted">No classes yet.</p>}
      </ul>
    </Card>
  );
}

export default function TeacherHome() {
  return (
    <Tabs tabs={['Tests', 'Classes']}>
      {(t) => (t === 'Tests' ? <TestsPanel /> : <Classes />)}
    </Tabs>
  );
}
