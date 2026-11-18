import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Bar, Card, useAction } from '../components/ui.jsx';

export default function ClassDetail() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [myTests, setMyTests] = useState([]);
  const [emails, setEmails] = useState('');
  const [testId, setTestId] = useState('');
  const [msg, setMsg] = useState('');
  const act = useAction();

  const load = useCallback(async () => {
    const [i, a, t] = await Promise.all([api.get(`/classes/${id}`), api.get(`/classes/${id}/analytics`), api.get('/tests/mine')]);
    setInfo(i); setAnalytics(a); setMyTests(t.tests.filter((x) => x.kind === 'class' && x.isPublished));
  }, [id]);
  useEffect(() => { load().catch((e) => act.setError(e.message)); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const addStudents = (e) => {
    e.preventDefault();
    act.run(async () => {
      const list = emails.split(/[\s,;]+/).filter(Boolean);
      const r = await api.post(`/classes/${id}/students`, { emails: list });
      setMsg(`Added ${r.added}.${r.notFound.length ? ` Not found as students: ${r.notFound.join(', ')}` : ''}`);
      setEmails(''); load();
    });
  };
  const assign = (e) => {
    e.preventDefault();
    act.run(async () => { await api.post(`/classes/${id}/assign`, { testId }); setTestId(''); setMsg('Test assigned'); load(); });
  };
  const removeStudent = (sid) => act.run(async () => { await api.del(`/classes/${id}/students/${sid}`); load(); });

  if (!info) return act.error ? <Alert>{act.error}</Alert> : <p className="muted">Loading…</p>;
  const unassigned = myTests.filter((t) => !info.tests.some((x) => x._id === t._id));

  return (
    <div className="stack">
      <Link to="/teacher" className="link">← Back</Link>
      <h2>{info.class.name}</h2>
      <Alert>{act.error}</Alert>
      <Alert kind="info">{msg}</Alert>

      <div className="grid">
        <Card title={`Students (${info.students.length})`}>
          <form className="row" onSubmit={addStudents}>
            <input className="grow" required placeholder="student emails, comma separated" value={emails} onChange={(e) => setEmails(e.target.value)} />
            <button className="btn" disabled={act.busy}>Add</button>
          </form>
          <p className="muted small">Students must already have registered with the Student role.</p>
          <ul className="list">
            {info.students.map((s) => (
              <li key={s._id}><div><strong>{s.name}</strong><div className="muted small">{s.email}</div></div>
                <button className="link" onClick={() => removeStudent(s._id)}>Remove</button></li>
            ))}
          </ul>
        </Card>

        <Card title="Assigned tests">
          <form className="row" onSubmit={assign}>
            <select className="grow" required value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="">Select a published test…</option>
              {unassigned.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
            </select>
            <button className="btn" disabled={act.busy || !testId}>Assign</button>
          </form>
          <ul className="list">
            {info.tests.map((t) => <li key={t._id}><div><strong>{t.title}</strong><div className="muted small">{t.questionCount} questions</div></div></li>)}
            {info.tests.length === 0 && <p className="muted">No tests assigned yet. Publish a test first, then assign it here.</p>}
          </ul>
        </Card>
      </div>

      {analytics && (
        <Card title="Class analytics">
          {analytics.totalAttempts === 0 ? <p className="muted">No attempts yet.</p> : (
            <>
              <p><strong>{analytics.totalAttempts}</strong> attempts · average <strong>{analytics.averagePercentage}%</strong></p>
              <h4>Score distribution</h4>
              {Object.entries(analytics.distribution).map(([k, v]) => (
                <Bar key={k} label={`${k}%`} value={analytics.totalAttempts ? (v / analytics.totalAttempts) * 100 : 0} note={String(v)} />
              ))}
              <h4>Weakest topics</h4>
              {analytics.weakestTopics.map((t) => <Bar key={t.topic} label={t.topic} value={t.accuracy} />)}
              <h4>Per student</h4>
              <table>
                <thead><tr><th>Student</th><th>Attempts</th><th>Average</th></tr></thead>
                <tbody>
                  {analytics.perStudent.map((s) => (
                    <tr key={s.studentId}><td>{s.name}</td><td>{s.attempts}</td><td>{s.averagePercentage === null ? '—' : `${s.averagePercentage}%`}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
