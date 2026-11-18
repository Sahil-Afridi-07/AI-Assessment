import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, Card, Spinner, useLoad, useUI } from '../../components/ui.jsx';
import { MAX_QUESTIONS, MSG, SECONDS, fmtDuration } from '../../messages.js';

const PRESETS = [5, 10, 15, 20, 30];
const DIFFS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['mixed', 'Mixed']];

// Even split used as the default for manual per-subject counts
function evenSplit(ids, total) {
  const base = Math.floor(total / ids.length); let rem = total % ids.length;
  return Object.fromEntries(ids.map((id) => [id, base + (rem-- > 0 ? 1 : 0)]));
}

export default function Practice() {
  const nav = useNavigate();
  const { toast } = useUI();
  const { data: cat, error: catError, loading } = useLoad(() => api.get('/practice/catalog'));

  const [search, setSearch] = useState('');
  const [subjects, setSubjects] = useState([]); // ids, in selection order
  const [topics, setTopics] = useState({}); // id -> [topic names]
  const [custom, setCustom] = useState({}); // id -> text
  const [difficulty, setDifficulty] = useState('medium');
  const [preset, setPreset] = useState(10); // number | 'custom'
  const [customCount, setCustomCount] = useState('');
  const [manual, setManual] = useState(false);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [badSubject, setBadSubject] = useState(null);
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => (cat ? cat.categories.flatMap((c) => c.subjects.map((s) => ({ ...s, category: c.name }))) : []), [cat]);
  const byId = useMemo(() => Object.fromEntries(all.map((s) => [s.id, s])), [all]);

  const total = preset === 'custom' ? Number(customCount) : preset;
  const totalValid = Number.isInteger(total) && total >= 1 && total <= MAX_QUESTIONS;

  const toggleSubject = (id) => {
    setError(''); setBadSubject(null);
    setSubjects((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 6 ? cur : [...cur, id];
      if (manual && totalValid && next.length) setCounts(evenSplit(next, total));
      return next;
    });
  };
  const toggleTopic = (id, t) => {
    setError('');
    setTopics((cur) => ({ ...cur, [id]: (cur[id] || []).includes(t) ? cur[id].filter((x) => x !== t) : [...(cur[id] || []), t] }));
  };
  const setManualMode = (on) => {
    setManual(on);
    if (on && totalValid && subjects.length) setCounts(evenSplit(subjects, total));
  };

  const q = search.trim().toLowerCase();
  const matches = (s) => !q || s.name.toLowerCase().includes(q) || s.topics.some((t) => t.toLowerCase().includes(q));

  const manualSum = subjects.reduce((s, id) => s + (Number(counts[id]) || 0), 0);

  // Rough estimate for the summary; the exact duration (from the generated questions) is shown before starting.
  const estimate = !totalValid ? null
    : difficulty === 'mixed'
      ? Math.round(total * 0.4) * SECONDS.easy + (total - Math.round(total * 0.4) - Math.round(total * 0.2)) * SECONDS.medium + Math.round(total * 0.2) * SECONDS.hard
      : total * SECONDS[difficulty];

  // Frontend validation - same rules and wording as the server
  const validate = () => {
    if (!subjects.length) return MSG.NO_SUBJECT;
    if (!totalValid) return MSG.BAD_COUNT;
    if (subjects.length > total) return 'Please request at least one question per selected subject.';
    for (const id of subjects) {
      const hasCustom = (custom[id] || '').split(/[\n,;]+/).some((x) => x.trim());
      if (!(topics[id] || []).length && !hasCustom) return MSG.NO_TOPIC;
    }
    if (manual) {
      if (subjects.some((id) => !Number.isInteger(Number(counts[id])) || Number(counts[id]) < 1)) return MSG.BAD_COUNT;
      if (manualSum !== total) return `The per-subject counts add up to ${manualSum}, but the total is ${total}. Please make them match.`;
    }
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    setBadSubject(null);
    if (v) return setError(v);
    setError(''); setBusy(true);
    try {
      const d = await api.post('/practice/generate', {
        subjects, topics, customSubtopics: custom, difficulty, totalQuestions: total,
        ...(manual ? { distribution: Object.fromEntries(subjects.map((id) => [id, Number(counts[id])])) } : {}),
      });
      toast('Assessment generated');
      nav(`/student/start/${d.test._id}`);
    } catch (err) {
      setError(err.message);
      if (err.code === 'INVALID_TOPIC') setBadSubject(err.data?.subject || null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;
  if (catError) return <Alert>{catError}</Alert>;

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="page-head"><div><h2>Practice</h2><p className="muted">Build your own AI-generated assessment from one or more subjects.</p></div></div>

      <Card title="1. Choose subjects" action={<span className="muted small">{subjects.length}/6 selected</span>}>
        <input type="search" placeholder="Search subjects or topics…" aria-label="Search subjects" value={search} onChange={(e) => setSearch(e.target.value)} />
        {cat.categories.map((c) => {
          const list = c.subjects.filter(matches);
          if (!list.length) return null;
          return (
            <div key={c.name} className="cat">
              <div className="cat-name">{c.name}</div>
              <div className="chips">
                {list.map((s) => (
                  <button type="button" key={s.id} aria-pressed={subjects.includes(s.id)} className={subjects.includes(s.id) ? 'pick on' : 'pick'} onClick={() => toggleSubject(s.id)}>{s.name}</button>
                ))}
              </div>
            </div>
          );
        })}
        {all.filter(matches).length === 0 && <p className="muted">No subject matches “{search}”.</p>}
      </Card>

      {subjects.map((id) => (
        <Card key={id} title={`2. ${byId[id].name}: topics`} className={badSubject === id ? 'card-bad' : ''}>
          <div className="chips">
            {byId[id].topics.map((t) => (
              <button type="button" key={t} aria-pressed={(topics[id] || []).includes(t)} className={(topics[id] || []).includes(t) ? 'pick on sm' : 'pick sm'} onClick={() => toggleTopic(id, t)}>{t}</button>
            ))}
          </div>
          <label>Custom subtopics (optional)
            <textarea rows="2" placeholder={`Comma or line separated, e.g. specific ${byId[id].name} concepts`} value={custom[id] || ''}
              onChange={(e) => { setCustom({ ...custom, [id]: e.target.value }); setError(''); setBadSubject(null); }} />
          </label>
          <p className="muted small">Subtopics must belong to {byId[id].name}; unrelated input is rejected.</p>
        </Card>
      ))}

      <Card title="3. Difficulty and size">
        <div className="seg" role="radiogroup" aria-label="Difficulty">
          {DIFFS.map(([v, l]) => <button type="button" key={v} role="radio" aria-checked={difficulty === v} className={difficulty === v ? 'seg-b on' : 'seg-b'} onClick={() => setDifficulty(v)}>{l}</button>)}
        </div>
        <p className="muted small">{difficulty === 'mixed' ? 'Mixed: about 40% easy, 40% medium and 20% hard.' : 'Time per question: easy 1 min, medium 1.5 min, hard 2 min.'}</p>

        <div className="seg" role="radiogroup" aria-label="Number of questions">
          {PRESETS.map((n) => <button type="button" key={n} role="radio" aria-checked={preset === n} className={preset === n ? 'seg-b on' : 'seg-b'} onClick={() => { setPreset(n); setError(''); if (manual && subjects.length) setCounts(evenSplit(subjects, n)); }}>{n}</button>)}
          <button type="button" role="radio" aria-checked={preset === 'custom'} className={preset === 'custom' ? 'seg-b on' : 'seg-b'} onClick={() => setPreset('custom')}>Custom</button>
        </div>
        {preset === 'custom' && (
          <label>Number of questions (1–{MAX_QUESTIONS})
            <input type="number" min="1" max={MAX_QUESTIONS} value={customCount} onChange={(e) => { setCustomCount(e.target.value); setError(''); }} />
          </label>
        )}

        {subjects.length > 1 && (
          <label className="check"><input type="checkbox" checked={manual} onChange={(e) => setManualMode(e.target.checked)} />Set the number of questions per subject myself</label>
        )}
        {manual && subjects.length > 1 && (
          <div className="stack">
            {subjects.map((id) => (
              <label key={id} className="row between">{byId[id].name}
                <input type="number" min="1" className="num" value={counts[id] ?? ''} onChange={(e) => setCounts({ ...counts, [id]: e.target.value })} />
              </label>
            ))}
            <p className={manualSum === total ? 'muted small' : 'alert error'}>Total: {manualSum} of {totalValid ? total : '?'} questions</p>
          </div>
        )}
      </Card>

      <Card title="Summary">
        <ul className="summary">
          <li><span>Subjects</span><strong>{subjects.length ? subjects.map((id) => byId[id].name).join(', ') : '—'}</strong></li>
          <li><span>Questions</span><strong>{totalValid ? total : '—'}</strong></li>
          <li><span>Difficulty</span><strong>{difficulty}</strong></li>
          <li><span>Estimated time</span><strong>{estimate ? fmtDuration(estimate) : '—'}</strong></li>
        </ul>
        <Alert>{error}</Alert>
        <button className="btn" disabled={busy}>{busy ? 'Generating your assessment… this can take up to a minute' : 'Generate assessment'}</button>
      </Card>
    </form>
  );
}
