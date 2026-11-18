import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, Spinner, useUI } from '../../components/ui.jsx';
import { fmtClock } from '../../messages.js';

// Distraction-free exam. The countdown is DISPLAY ONLY - the server owns the deadline and rejects late work.
export default function Exam() {
  const { attemptId } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUI();

  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState({}); // questionId -> { selected, marked, timeSpentSec }
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [saveState, setSaveState] = useState('saved'); // saved | saving | error
  const [submitting, setSubmitting] = useState(false);

  const offsetRef = useRef(0); // serverNow - clientNow, so a wrong device clock cannot change the countdown
  const deadlineRef = useRef(null);
  const answersRef = useRef({});
  const dirtyRef = useRef(false);
  const submittingRef = useRef(false);
  const startedViewRef = useRef(Date.now()); // when the current question was opened
  const idxRef = useRef(0);
  const questionsRef = useRef([]);
  const debounceRef = useRef(null);

  const goResult = useCallback(() => nav(`/student/reports/${attemptId}`, { replace: true }), [nav, attemptId]);

  // ---- load (also used after refresh) ----
  useEffect(() => {
    api.get(`/attempts/${attemptId}/session`).then((d) => {
      if (d.finished) return goResult();
      offsetRef.current = d.attempt.serverNow - Date.now();
      deadlineRef.current = d.attempt.deadlineAt ? new Date(d.attempt.deadlineAt).getTime() : null;
      const map = {};
      for (const a of d.answers) map[a.questionId] = { selected: a.selected, marked: a.marked, timeSpentSec: a.timeSpentSec };
      answersRef.current = map; setAnswers(map);
      questionsRef.current = d.questions;
      setSession(d);
      startedViewRef.current = Date.now();
    }).catch((e) => setLoadError(e.message));
  }, [attemptId, goResult]);

  // Add the time spent on the current question to its record
  const flushTime = useCallback(() => {
    const q = questionsRef.current[idxRef.current];
    if (!q) return;
    const now = Date.now();
    const add = Math.round((now - startedViewRef.current) / 1000);
    startedViewRef.current = now;
    if (add <= 0) return;
    const cur = answersRef.current[q._id] || { selected: null, marked: false, timeSpentSec: 0 };
    answersRef.current = { ...answersRef.current, [q._id]: { ...cur, timeSpentSec: (cur.timeSpentSec || 0) + add } };
    dirtyRef.current = true;
  }, []);

  const payload = () => questionsRef.current.map((q) => {
    const a = answersRef.current[q._id] || {};
    return { questionId: q._id, selected: a.selected ?? null, marked: !!a.marked, timeSpentSec: a.timeSpentSec || 0 };
  });

  const save = useCallback(async () => {
    if (submittingRef.current || !dirtyRef.current) return;
    flushTime();
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      await api.put(`/attempts/${attemptId}/answers`, { answers: payload() });
      setSaveState('saved');
    } catch (e) {
      if (e.code === 'EXPIRED' || e.code === 'FINISHED') { toast(e.message, 'info'); return goResult(); }
      dirtyRef.current = true; // retry on the next tick
      setSaveState('error');
    }
  }, [attemptId, flushTime, goResult, toast]);

  // autosave: every 15 s (and ~1.5 s after a change, see update())
  useEffect(() => {
    if (!session) return undefined;
    const t = setInterval(save, 15000);
    return () => { clearInterval(t); clearTimeout(debounceRef.current); };
  }, [session, save]);

  const submit = useCallback(async (auto) => {
    if (submittingRef.current) return;
    submittingRef.current = true; setSubmitting(true);
    flushTime();
    try {
      const r = await api.post(`/attempts/${attemptId}/submit`, { answers: payload(), auto });
      if (r.expired) toast('Time was up. Your saved answers were submitted.', 'info');
      goResult();
    } catch (e) {
      if (e.code === 'FINISHED' || e.status === 409) return goResult();
      submittingRef.current = false; setSubmitting(false);
      toast(e.message, 'error');
    }
  }, [attemptId, flushTime, goResult, toast]);

  // countdown (display); at zero ask the server to close the attempt
  useEffect(() => {
    if (!session || deadlineRef.current == null) return undefined;
    const tick = () => {
      const left = Math.ceil((deadlineRef.current - (Date.now() + offsetRef.current)) / 1000);
      setRemaining(left);
      if (left <= 0 && !submittingRef.current) { toast("Time is up - submitting your answers.", 'info'); submit(true); }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [session, submit, toast]);

  const update = (qid, patch) => {
    flushTime();
    const cur = answersRef.current[qid] || { selected: null, marked: false, timeSpentSec: 0 };
    answersRef.current = { ...answersRef.current, [qid]: { ...cur, ...patch } };
    setAnswers(answersRef.current);
    dirtyRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 1500); // save soon after a change
  };

  const move = (i) => { flushTime(); idxRef.current = i; startedViewRef.current = Date.now(); setIdx(i); };

  const askSubmit = async () => {
    const qs = questionsRef.current;
    const un = qs.filter((q) => answersRef.current[q._id]?.selected == null).length;
    const mk = qs.filter((q) => answersRef.current[q._id]?.marked).length;
    const ok = await confirm({
      title: 'Submit your test?',
      message: (<><p>You have answered {qs.length - un} of {qs.length} questions.</p>{un > 0 && <p><strong>{un} unanswered.</strong></p>}{mk > 0 && <p>{mk} marked for review.</p>}<p>You cannot change your answers after submitting.</p></>),
      confirmText: 'Submit test',
    });
    if (ok) submit(false);
  };

  if (loadError) return <div className="container"><Alert>{loadError}</Alert></div>;
  if (!session) return <Spinner label="Loading your assessment…" />;

  const qs = session.questions;
  const q = qs[idx];
  const a = answers[q._id] || {};
  const answered = qs.filter((x) => answers[x._id]?.selected != null).length;
  const low = remaining != null && remaining <= 60;

  return (
    <div className="exam">
      <header className="exam-bar">
        <div><strong>{session.test.title}</strong><div className="small muted">{answered}/{qs.length} answered · <span className={`save ${saveState}`}>{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved - retrying' : 'All changes saved'}</span></div></div>
        <div className={low ? 'timer low' : 'timer'} role="timer" aria-live="off">{remaining == null ? 'No time limit' : fmtClock(remaining)}</div>
        <button className="btn" disabled={submitting} onClick={askSubmit}>{submitting ? 'Submitting…' : 'Submit test'}</button>
      </header>

      <div className="exam-body">
        <section className="exam-main card">
          <div className="row between">
            <span className="muted small">Question {idx + 1} of {qs.length}</span>
            <div className="row"><span className="chip">{q.difficulty}</span>
              <button type="button" className={a.marked ? 'btn ghost mark on' : 'btn ghost mark'} aria-pressed={!!a.marked} onClick={() => update(q._id, { marked: !a.marked })}>{a.marked ? '★ Marked for review' : '☆ Mark for review'}</button></div>
          </div>
          <h2 className="qtext">{q.text}</h2>
          <div className="options" role="radiogroup" aria-label="Answer options">
            {q.options.map((o, i) => (
              <label key={i} className={a.selected === i ? 'opt on' : 'opt'}>
                <input type="radio" name={q._id} checked={a.selected === i} onChange={() => update(q._id, { selected: i })} />
                <span className="letter">{'ABCD'[i]}</span><span>{o}</span>
              </label>
            ))}
          </div>
          {a.selected != null && <button type="button" className="link small" onClick={() => update(q._id, { selected: null })}>Clear my answer</button>}
          <div className="row between">
            <button className="btn ghost" disabled={idx === 0} onClick={() => move(idx - 1)}>Previous</button>
            <button className="btn" disabled={idx === qs.length - 1} onClick={() => move(idx + 1)}>Next</button>
          </div>
        </section>

        <aside className="exam-nav card" aria-label="Question navigator">
          <strong>Questions</strong>
          <div className="dots">
            {qs.map((x, i) => {
              const st = answers[x._id] || {};
              const cls = ['dot', i === idx ? 'cur' : '', st.selected != null ? 'done' : '', st.marked ? 'marked' : ''].join(' ');
              return <button key={x._id} className={cls} aria-label={`Question ${i + 1}${st.selected != null ? ', answered' : ', unanswered'}${st.marked ? ', marked for review' : ''}`} onClick={() => move(i)}>{i + 1}</button>;
            })}
          </div>
          <ul className="legend small muted">
            <li><span className="dot done" /> Answered</li><li><span className="dot" /> Unanswered</li><li><span className="dot marked" /> Marked for review</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
