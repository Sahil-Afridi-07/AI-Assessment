import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, Card, Empty, Spinner, Stat, fmtDate, useLoad } from '../../components/ui.jsx';
import { fmtClock } from '../../messages.js';

export default function Dashboard() {
  const { data: d, error, loading } = useLoad(() => api.get('/student/dashboard'));
  const { data: assigned } = useLoad(() => api.get('/tests/assigned'));

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const pending = (assigned?.tests || []).filter((t) => !t.attempted);
  const change = d.progress.change;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h2>Dashboard</h2><p className="muted">A summary of your assessment activity.</p></div>
        <Link className="btn" to="/student/practice">Start a practice test</Link>
      </div>

      {d.inProgress && (
        <div className="banner">
          <div><strong>You have an assessment in progress</strong><div className="small">{d.inProgress.title} · {fmtClock(d.inProgress.secondsRemaining ?? 0)} remaining</div></div>
          <Link className="btn" to={`/student/exam/${d.inProgress.attemptId}`}>Resume</Link>
        </div>
      )}

      <div className="stats">
        <Stat label="Tests attempted" value={d.totalAttempts} />
        <Stat label="Average score" value={`${d.averageScore}%`} />
        <Stat label="Highest score" value={`${d.highestScore}%`} />
        <Stat label="Overall accuracy" value={`${d.overallAccuracy}%`} hint={d.totalQuestions ? `${d.totalCorrect}/${d.totalQuestions} questions` : undefined} />
      </div>

      <div className="grid">
        <Card title="Recent activity" action={d.recent.length > 0 && <Link to="/student/reports" className="link">View all reports</Link>}>
          {d.recent.length === 0
            ? <Empty title="No assessments yet" action={<Link className="btn" to="/student/practice">Generate your first test</Link>}>Your completed tests will appear here.</Empty>
            : (
              <ul className="list">
                {d.recent.map((a) => (
                  <li key={a.attemptId}>
                    <div><strong>{a.title}</strong><div className="muted small">{fmtDate(a.submittedAt)}</div></div>
                    <Link className="btn ghost" to={`/student/reports/${a.attemptId}`}>{a.score}/{a.total} · {a.percentage}%</Link>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card title="Learning progress">
          {d.totalAttempts === 0 ? <p className="muted">Complete a test to start tracking your progress.</p> : (
            <>
              <p className="big">{d.progress.latestAverage}%<span className="muted small"> average of your latest {Math.min(5, d.totalAttempts)} test(s)</span></p>
              {change === null
                ? <p className="muted small">Take more tests to see how you are trending.</p>
                : <p className={change >= 0 ? 'trend up' : 'trend down'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)} points vs your previous {Math.min(5, d.totalAttempts - 5)} test(s)</p>}
            </>
          )}
        </Card>

        <Card title="Recommended topics to practice">
          {d.recommendedTopics.length === 0
            ? <p className="muted">{d.totalAttempts === 0 ? 'Recommendations appear after your first test.' : 'No weak topics found so far. Keep practising!'}</p>
            : (
              <ul className="list">
                {d.recommendedTopics.map((t) => (
                  <li key={t.topic}><div><strong>{t.topic}</strong><div className="muted small">{t.correct}/{t.total} correct</div></div><span className="chip bad">{Math.round(t.accuracy)}%</span></li>
                ))}
              </ul>
            )}
          <Link className="btn ghost" to="/student/practice">Practice now</Link>
        </Card>

        <Card title="Assigned to me">
          {pending.length === 0 ? <p className="muted">No pending assigned tests.</p> : (
            <ul className="list">
              {pending.map((t) => (
                <li key={t._id}><div><strong>{t.title}</strong><div className="muted small">{t.assignedFrom}</div></div><Link className="btn" to={`/student/start/${t._id}`}>Start</Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
