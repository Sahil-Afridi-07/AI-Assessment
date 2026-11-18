import { useState } from 'react';
import { api } from '../api.js';
import { Alert, useAction } from './ui.jsx';

const blank = () => ({ text: '', options: ['', '', '', ''], correctOption: 0, generatedBy: 'Manual' });

// Create a test with AI-generated and/or manually written questions.
export default function TestBuilder({ onSaved }) {
  const [meta, setMeta] = useState({ title: '', topic: '', difficulty: 'medium' });
  const [ai, setAi] = useState({ count: 5 });
  const [questions, setQuestions] = useState([]);
  const [draft, setDraft] = useState(blank());
  const gen = useAction();
  const save = useAction();
  const [formError, setFormError] = useState('');

  const generate = () => {
    if (!meta.topic.trim()) return setFormError('Enter a topic first');
    setFormError('');
    gen.run(async () => {
      const d = await api.post('/ai/questions', { topic: meta.topic, difficulty: meta.difficulty, count: Number(ai.count) });
      setQuestions((qs) => [...qs, ...d.questions]);
    });
  };

  const addManual = () => {
    if (!draft.text.trim() || draft.options.some((o) => !o.trim())) return setFormError('Fill the question and all 4 options');
    setFormError('');
    setQuestions((qs) => [...qs, { ...draft, topic: meta.topic }]);
    setDraft(blank());
  };

  const updateQ = (i, patch) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const updateOpt = (i, j, v) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, options: q.options.map((o, m) => (m === j ? v : o)) } : q)));

  const saveTest = () => {
    if (!meta.title.trim() || !meta.topic.trim()) return setFormError('Title and topic are required');
    if (!questions.length) return setFormError('Add at least one question');
    setFormError('');
    save.run(async () => {
      await api.post('/tests', { ...meta, questions });
      setQuestions([]); setMeta({ title: '', topic: '', difficulty: 'medium' });
      onSaved?.();
    });
  };

  return (
    <div className="stack">
      <div className="row">
        <label className="grow">Title<input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></label>
        <label className="grow">Topic<input value={meta.topic} onChange={(e) => setMeta({ ...meta, topic: e.target.value })} /></label>
        <label>Difficulty
          <select value={meta.difficulty} onChange={(e) => setMeta({ ...meta, difficulty: e.target.value })}>
            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <strong>Generate with AI</strong>
        <div className="row">
          <label>Count<input type="number" min="1" max="20" value={ai.count} onChange={(e) => setAi({ count: e.target.value })} /></label>
          <button type="button" className="btn" disabled={gen.busy} onClick={generate}>{gen.busy ? 'Generating…' : 'Generate questions'}</button>
        </div>
        <Alert>{gen.error}</Alert>
      </div>

      <div className="panel">
        <strong>Add a question manually</strong>
        <label>Question<textarea rows="2" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></label>
        {draft.options.map((o, j) => (
          <div className="row opt-edit" key={j}>
            <input type="radio" name="draft-correct" aria-label={`Option ${'ABCD'[j]} is correct`} checked={draft.correctOption === j} onChange={() => setDraft({ ...draft, correctOption: j })} />
            <input className="grow" placeholder={`Option ${'ABCD'[j]}`} value={o} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, m) => (m === j ? e.target.value : x)) })} />
          </div>
        ))}
        <p className="muted small">Select the radio next to the correct option.</p>
        <button type="button" className="btn ghost" onClick={addManual}>Add question</button>
      </div>

      <div>
        <strong>Questions in this test ({questions.length})</strong>
        {questions.map((q, i) => (
          <div className="qcard" key={i}>
            <div className="row between">
              <span className="chip">{q.generatedBy}</span>
              <button type="button" className="link" onClick={() => setQuestions(questions.filter((_, k) => k !== i))}>Remove</button>
            </div>
            <textarea rows="2" value={q.text} onChange={(e) => updateQ(i, { text: e.target.value })} />
            {q.options.map((o, j) => (
              <div className="row opt-edit" key={j}>
                <input type="radio" name={`q-${i}`} aria-label={`Option ${'ABCD'[j]} is correct`} checked={q.correctOption === j} onChange={() => updateQ(i, { correctOption: j })} />
                <input className="grow" value={o} onChange={(e) => updateOpt(i, j, e.target.value)} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <Alert>{formError || save.error}</Alert>
      <button className="btn" disabled={save.busy} onClick={saveTest}>{save.busy ? 'Saving…' : 'Save test'}</button>
    </div>
  );
}
