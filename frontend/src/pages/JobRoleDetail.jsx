import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Card, useAction } from '../components/ui.jsx';

export default function JobRoleDetail() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [results, setResults] = useState(null);
  const [myTests, setMyTests] = useState([]);
  const [emails, setEmails] = useState('');
  const [testId, setTestId] = useState('');
  const [msg, setMsg] = useState('');
  const act = useAction();

  const load = useCallback(async () => {
    const [i, r, t] = await Promise.all([api.get(`/jobroles/${id}`), api.get(`/jobroles/${id}/results`), api.get('/tests/mine')]);
    setInfo(i); setResults(r); setMyTests(t.tests.filter((x) => x.kind === 'screening' && x.isPublished));
  }, [id]);
  useEffect(() => { load().catch((e) => act.setError(e.message)); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = (e) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api.post(`/jobroles/${id}/invite`, { emails: emails.split(/[\s,;]+/).filter(Boolean) });
      setMsg(`Invited ${r.invited} candidate(s). They sign up / log in as a Student with that email to see the test.`);
      setEmails(''); load();
    });
  };
  const attach = (e) => {
    e.preventDefault();
    act.run(async () => { await api.post(`/jobroles/${id}/tests`, { testId }); setTestId(''); setMsg('Test attached'); load(); });
  };

  if (!info) return act.error ? <Alert>{act.error}</Alert> : <p className="muted">Loading…</p>;
  const available = myTests.filter((t) => !info.tests.some((x) => x._id === t._id));

  return (
    <div className="stack">
      <Link to="/company" className="link">← Back</Link>
      <h2>{info.jobRole.roleName}</h2>
      <Alert>{act.error}</Alert>
      <Alert kind="info">{msg}</Alert>

      <div className="grid">
        <Card title="Screening tests">
          <form className="row" onSubmit={attach}>
            <select className="grow" required value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="">Select a published test…</option>
              {available.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
            </select>
            <button className="btn" disabled={act.busy || !testId}>Attach</button>
          </form>
          <ul className="list">
            {info.tests.map((t) => <li key={t._id}><strong>{t.title}</strong><span className="muted small">{t.questionCount} questions</span></li>)}
            {info.tests.length === 0 && <p className="muted">Create and publish a test under "Screening tests", then attach it here.</p>}
          </ul>
        </Card>

        <Card title={`Invite candidates (${info.jobRole.invitedEmails.length})`}>
          <form className="row" onSubmit={invite}>
            <input className="grow" required placeholder="candidate emails, comma separated" value={emails} onChange={(e) => setEmails(e.target.value)} />
            <button className="btn" disabled={act.busy}>Invite</button>
          </form>
          <p className="muted small">Pending: {results?.pending.length ? results.pending.join(', ') : 'none'}</p>
        </Card>
      </div>

      <Card title="Ranked results">
        {!results || results.ranked.length === 0 ? <p className="muted">No candidate has completed a test yet.</p> : (
          <table>
            <thead><tr><th>Rank</th><th>Candidate</th><th>Score</th><th>%</th><th>Submitted</th><th /></tr></thead>
            <tbody>
              {results.ranked.map((r) => (
                <tr key={r.candidateId}>
                  <td><strong>#{r.rank}</strong></td>
                  <td>{r.name}<div className="muted small">{r.email}</div></td>
                  <td>{r.score}/{r.total}</td>
                  <td>{r.percentage}%</td>
                  <td className="small">{new Date(r.submittedAt).toLocaleString()}</td>
                  <td><Link to={`/review/${r.attemptId}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
