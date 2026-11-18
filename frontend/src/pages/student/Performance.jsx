import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, Card, Empty, Spinner, Stat, useAction, useLoad, useUI } from '../../components/ui.jsx';
import { useState } from 'react';

const BLUE = '#3d6fb4';
const AXIS = { fontSize: 12, fill: '#6b7686' };
const fmtD = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const pctTip = (v) => [`${v}%`, 'Accuracy'];

function AccuracyBars({ rows, nameKey }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 44)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="#e8edf3" />
        <XAxis type="number" domain={[0, 100]} tick={AXIS} unit="%" />
        <YAxis type="category" dataKey={nameKey} width={130} tick={AXIS} />
        <Tooltip formatter={pctTip} />
        <RBar dataKey="accuracy" fill={BLUE} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BreakdownTable({ rows, nameKey, label }) {
  return (
    <table>
      <thead><tr><th>{label}</th><th>Correct</th><th>Incorrect</th><th>Accuracy</th><th>Avg time / question</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[nameKey]}>
            <td>{r[nameKey]}</td><td>{r.correct}</td><td>{r.incorrect}</td><td>{r.accuracy}%</td>
            <td>{r.avgTimePerQuestionSec == null ? '—' : `${r.avgTimePerQuestionSec}s`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Performance() {
  const { data: p, error, loading } = useLoad(() => api.get('/student/performance'));
  const [analysis, setAnalysis] = useState(null);
  const gen = useAction();
  const { toast } = useUI();

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (p.overview.totalAttempts === 0) {
    return (
      <div className="stack">
        <h2>Performance</h2>
        <Card><Empty title="No performance data yet" action={<Link className="btn" to="/student/practice">Take a practice test</Link>}>Charts appear once you complete an assessment.</Empty></Card>
      </div>
    );
  }

  const topicsRated = [...p.topics].sort((a, b) => b.total - a.total).slice(0, 8);
  const runAnalysis = () => gen.run(async () => { setAnalysis(await api.post('/student/performance/analysis')); toast('Analysis updated'); });

  return (
    <div className="stack">
      <h2>Performance</h2>
      <div className="stats">
        <Stat label="Overall accuracy" value={`${p.overview.overallAccuracy}%`} />
        <Stat label="Correct answers" value={p.overview.totalCorrect} />
        <Stat label="Incorrect / unanswered" value={p.incorrectTotal} />
        <Stat label="Avg time per question" value={p.avgTimePerQuestionSec == null ? '—' : `${p.avgTimePerQuestionSec}s`} hint="estimated from timed practice tests" />
      </div>

      <Card title="AI performance analysis" action={<button className="btn" onClick={runAnalysis} disabled={gen.busy}>{gen.busy ? 'Analysing…' : analysis ? 'Refresh analysis' : 'Generate analysis'}</button>}>
        <Alert>{gen.error}</Alert>
        {analysis
          ? (<><p>{analysis.text}</p><p className="muted small">Based on {analysis.basedOn.attempts} assessment(s) and {analysis.basedOn.questions} question(s). {analysis.source === 'ai' ? 'Written by AI from your saved results.' : 'Generated from your saved results using fixed rules.'}</p></>)
          : <p className="muted">Get a written summary of your strengths and what to practice next, based only on your saved results.</p>}
      </Card>

      <Card title="Performance trend">
        {p.trend.length < 2
          ? <p className="muted">Complete at least two assessments to see a trend.</p>
          : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={p.trend.map((t) => ({ ...t, label: fmtD(t.date) }))} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid stroke="#e8edf3" />
                <XAxis dataKey="label" tick={AXIS} />
                <YAxis domain={[0, 100]} tick={AXIS} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Score']} labelFormatter={(l, items) => items?.[0]?.payload?.title || l} />
                <Line type="monotone" dataKey="percentage" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
      </Card>

      <div className="grid">
        <Card title="Subject-wise performance">
          {p.subjects.length === 0 ? <p className="muted">Subject data is recorded for tests generated on the Practice page.</p> : <AccuracyBars rows={p.subjects} nameKey="subject" />}
        </Card>
        <Card title="Difficulty-wise performance">
          {p.difficulties.length === 0 ? <p className="muted">No difficulty data yet.</p> : <AccuracyBars rows={p.difficulties} nameKey="difficulty" />}
        </Card>
      </div>

      <Card title="Topic-wise performance">
        {topicsRated.length < 3 ? <AccuracyBars rows={topicsRated} nameKey="topic" /> : (
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={topicsRated} outerRadius="72%">
              <PolarGrid stroke="#e1e6ec" />
              <PolarAngleAxis dataKey="topic" tick={AXIS} />
              <PolarRadiusAxis domain={[0, 100]} tick={AXIS} angle={90} />
              <Radar dataKey="accuracy" stroke={BLUE} fill={BLUE} fillOpacity={0.3} />
              <Tooltip formatter={pctTip} />
            </RadarChart>
          </ResponsiveContainer>
        )}
        <p className="muted small">Showing your {topicsRated.length} most-practised topic(s).</p>
      </Card>

      <div className="grid">
        <Card title="Strong topics">
          {p.strong.length === 0 ? <p className="muted">No topic at 70% or higher yet (minimum 2 answered questions).</p> : p.strong.map((t) => <div className="pill-row" key={t.topic}><span>{t.topic}</span><span className="chip ok">{Math.round(t.accuracy)}%</span></div>)}
        </Card>
        <Card title="Weak topics">
          {p.weak.length === 0 ? <p className="muted">No topic below 60% (minimum 2 answered questions).</p> : p.weak.map((t) => <div className="pill-row" key={t.topic}><span>{t.topic}</span><span className="chip bad">{Math.round(t.accuracy)}%</span></div>)}
        </Card>
      </div>

      <Card title="Details">
        {p.subjects.length > 0 && <BreakdownTable rows={p.subjects} nameKey="subject" label="Subject" />}
        {p.difficulties.length > 0 && <BreakdownTable rows={p.difficulties} nameKey="difficulty" label="Difficulty" />}
        <BreakdownTable rows={[...p.topics].sort((a, b) => a.topic.localeCompare(b.topic))} nameKey="topic" label="Topic" />
      </Card>
    </div>
  );
}
