import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, Card, Spinner, useAction, useLoad } from '../../components/ui.jsx';
import { fmtDuration } from '../../messages.js';

// Shown before an assessment starts: total time, question count, rules. The clock starts only on "Start".
export default function StartTest() {
  const { testId } = useParams();
  const nav = useNavigate();
  const { data, error, loading } = useLoad(() => api.get(`/tests/${testId}`), [testId]);
  const start = useAction();

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const { test, questions } = data;
  const timed = test.durationSeconds > 0;

  const go = () => start.run(async () => {
    const r = await api.post('/attempts/start', { testId: test._id });
    nav(`/student/exam/${r.attemptId}`, { replace: true });
  });

  return (
    <div className="stack narrow">
      <Card title={test.title}>
        <ul className="summary">
          <li><span>Subjects / topics</span><strong>{test.topic}</strong></li>
          <li><span>Questions</span><strong>{questions.length}</strong></li>
          <li><span>Total time</span><strong>{timed ? fmtDuration(test.durationSeconds) : 'No time limit'}</strong></li>
          <li><span>Difficulty</span><strong>{test.difficulty}</strong></li>
        </ul>
        <h4>Before you begin</h4>
        <ul className="rules">
          {timed && <li>The timer starts when you press Start and is kept on our server. Refreshing the page will not reset it.</li>}
          {timed && <li>When time runs out, your saved answers are submitted automatically.</li>}
          <li>Your answers are saved automatically as you go.</li>
          <li>You can mark questions for review and move freely between questions.</li>
          <li>Correct answers and explanations are shown only after you submit.</li>
        </ul>
        <Alert>{start.error}</Alert>
        <button className="btn" disabled={start.busy} onClick={go}>{start.busy ? 'Starting…' : 'Start assessment'}</button>
      </Card>
    </div>
  );
}
