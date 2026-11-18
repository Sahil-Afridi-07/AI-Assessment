import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, Card, Empty, Spinner, fmtDate, useLoad, useUI } from '../../components/ui.jsx';
import { STATUS_LABEL, fmtDuration } from '../../messages.js';

const BLANK = { from: '', to: '', subject: '', topic: '', difficulty: '', status: '' };

export default function Reports() {
  const [f, setF] = useState(BLANK);
  const [page, setPage] = useState(1);
  const { toast } = useUI();
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page, limit: 15 }).toString();
  const { data, error, loading } = useLoad(() => api.get(`/student/reports?${qs}`), [qs]);
  const [filterOpts, setFilterOpts] = useState(null);
  if (data && !filterOpts) setFilterOpts(data.filters); // options come from the unfiltered first load

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const pdf = (id) => api.download(`/student/reports/${id}/pdf`, `assessment-report-${id}.pdf`).catch((e) => toast(e.message, 'error'));
  const filtered = Object.values(f).some(Boolean);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="stack">
      <h2>Reports</h2>
      <Card title="Filters">
        <div className="filters">
          <label>From<input type="date" value={f.from} max={f.to || undefined} onChange={set('from')} /></label>
          <label>To<input type="date" value={f.to} min={f.from || undefined} onChange={set('to')} /></label>
          <label>Subject<select value={f.subject} onChange={set('subject')}><option value="">All</option>{(filterOpts?.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Topic<select value={f.topic} onChange={set('topic')}><option value="">All</option>{(filterOpts?.topics || []).map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Difficulty<select value={f.difficulty} onChange={set('difficulty')}><option value="">All</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label>Status<select value={f.status} onChange={set('status')}><option value="">All</option><option value="submitted">Submitted</option><option value="auto_submitted">Auto-submitted</option></select></label>
          <button className="btn ghost" disabled={!filtered} onClick={() => { setF(BLANK); setPage(1); }}>Reset</button>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : data && (
        <Card title={`${data.total} report${data.total === 1 ? '' : 's'}`}>
          {data.reports.length === 0
            ? <Empty title={filtered ? 'No reports match these filters' : 'No reports yet'} action={filtered ? null : <Link className="btn" to="/student/practice">Take a practice test</Link>}>{filtered ? 'Try changing or resetting the filters.' : 'Finished assessments are listed here.'}</Empty>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Assessment</th><th>Date</th><th>Subjects / topics</th><th>Difficulty</th><th>Qs</th><th>Correct</th><th>Incorrect</th><th>Score</th><th>Time</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {data.reports.map((r) => (
                      <tr key={r._id}>
                        <td><Link to={`/student/reports/${r._id}`}><strong>{r.title}</strong></Link></td>
                        <td className="small">{fmtDate(r.submittedAt)}</td>
                        <td className="small">{r.subjects.length ? r.subjects.join(', ') : '—'}<div className="muted">{r.topics.slice(0, 4).join(', ')}{r.topics.length > 4 ? '…' : ''}</div></td>
                        <td>{r.difficultyMode || '—'}</td>
                        <td>{r.total}</td><td>{r.correctCount}</td><td>{r.incorrectCount ?? '—'}</td>
                        <td><strong>{r.percentage}%</strong></td>
                        <td>{r.timeTakenSec ? fmtDuration(r.timeTakenSec) : '—'}</td>
                        <td className="small">{STATUS_LABEL[r.status] || r.status}</td>
                        <td><button className="btn ghost" onClick={() => pdf(r._id)}>PDF</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          {pages > 1 && (
            <div className="row between pager">
              <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="muted small">Page {page} of {pages}</span>
              <button className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
