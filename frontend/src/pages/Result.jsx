import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Bar, Card, Spinner, Stat, fmtDate, useUI } from '../components/ui.jsx';
import { STATUS_LABEL, fmtDuration } from '../messages.js';

// Detailed report for one finished attempt. Used by students (/student/reports/:id) and by
// teachers/companies (/review/:id) for attempts on tests they own.
export default function Result() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useUI();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/attempts/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!d) return <Spinner label="Loading report…" />;
  const { attempt: a, test, review } = d;
  const isStudent = user.role === 'student';
  const back = isStudent ? '/student/reports' : `/${user.role}`;
  const pdf = () => api.download(`/student/reports/${id}/pdf`, `assessment-report-${id}.pdf`).catch((e) => toast(e.message, 'error'));

  return (
    <div className="stack">
      <div className="page-head">
        <Link to={back} className="link">← Back</Link>
        {isStudent && <button className="btn" onClick={pdf}>Download PDF</button>}
      </div>
      <h2>{test?.title || 'Report'}</h2>
      <p className="muted small">{fmtDate(a.submittedAt)} · {STATUS_LABEL[a.status] || a.status}</p>

      <div className="stats">
        <Stat label="Score" value={`${a.percentage}%`} hint={`${a.score} of ${a.total}`} />
        <Stat label="Correct" value={a.correctCount} />
        <Stat label="Incorrect" value={a.incorrectCount} hint={a.unansweredCount ? `${a.unansweredCount} unanswered` : undefined} />
        <Stat label="Time taken" value={a.timeTakenSec ? fmtDuration(a.timeTakenSec) : '—'} />
      </div>

      {a.feedback && <Card title="AI recommendations"><p>{a.feedback}</p></Card>}

      <div className="grid">
        <Card title="Strengths">{a.strengths?.length ? a.strengths.map((t) => <div className="pill-row" key={t}><span>{t}</span><span className="chip ok">Strong</span></div>) : <p className="muted">No topic at 70% or above in this assessment.</p>}</Card>
        <Card title="Needs improvement">{a.weaknesses?.length ? a.weaknesses.map((t) => <div className="pill-row" key={t}><span>{t}</span><span className="chip bad">Weak</span></div>) : <p className="muted">No topic below 50%.</p>}</Card>
      </div>

      <Card title="Topic breakdown">
        {a.topicBreakdown.map((t) => <Bar key={t.topic} label={t.topic} value={t.total ? (t.correct / t.total) * 100 : 0} note={`${t.correct}/${t.total}`} />)}
      </Card>

      <Card title="Answer review">
        {review.map((r, i) => (
          <div key={r.questionId} className={`review ${r.isCorrect ? 'ok' : 'bad'}`}>
            <p><strong>{i + 1}. {r.text}</strong> <span className="muted small">({r.difficulty}{r.topic ? `, ${r.topic}` : ''}){r.marked ? ' · marked for review' : ''}</span></p>
            <ul>
              {r.options.map((o, k) => (
                <li key={k} className={k === r.correctOption ? 'right' : k === r.selected ? 'wrong' : ''}>
                  {'ABCD'[k]}. {o}
                  {k === r.correctOption && ' ✓ correct'}
                  {k === r.selected && k !== r.correctOption && ' ✗ your answer'}
                </li>
              ))}
            </ul>
            {r.selected === null && <p className="muted small">Not answered</p>}
            {r.explanation && <p className="explain"><strong>Explanation:</strong> {r.explanation}</p>}
          </div>
        ))}
      </Card>
    </div>
  );
}
