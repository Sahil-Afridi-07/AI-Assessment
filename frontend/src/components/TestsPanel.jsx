import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Card, useAction } from './ui.jsx';
import TestBuilder from './TestBuilder.jsx';

// List + create + publish/delete tests. Shared by Teacher and Company.
export default function TestsPanel() {
  const [tests, setTests] = useState([]);
  const [creating, setCreating] = useState(false);
  const act = useAction();

  const load = useCallback(() => api.get('/tests/mine').then((d) => setTests(d.tests)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const toggle = (t) => act.run(async () => { await api.patch(`/tests/${t._id}/publish`, { isPublished: !t.isPublished }); load(); });
  const remove = (t) => window.confirm(`Delete "${t.title}"?`) && act.run(async () => { await api.del(`/tests/${t._id}`); load(); });

  return (
    <Card title="My tests" action={<button className="btn" onClick={() => setCreating(!creating)}>{creating ? 'Close' : 'New test'}</button>}>
      {creating && <div className="panel"><TestBuilder onSaved={() => { setCreating(false); load(); }} /></div>}
      <Alert>{act.error}</Alert>
      {tests.length === 0 && !creating && <p className="muted">No tests yet. Create one using AI, manual questions, or both.</p>}
      <ul className="list">
        {tests.map((t) => (
          <li key={t._id}>
            <div>
              <strong>{t.title}</strong>
              <div className="muted small">{t.topic} · {t.difficulty} · {t.questionCount} questions · source: {t.source}</div>
            </div>
            <div className="row">
              <span className={t.isPublished ? 'chip ok' : 'chip'}>{t.isPublished ? 'Published' : 'Draft'}</span>
              <button className="btn ghost" onClick={() => toggle(t)}>{t.isPublished ? 'Unpublish' : 'Publish'}</button>
              <button className="btn ghost danger" onClick={() => remove(t)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
