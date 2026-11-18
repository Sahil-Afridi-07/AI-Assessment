// End-to-end checks for the Student panel v2 (practice generation, timed attempts, reports, account).
// Start the API first (AI_PROVIDER=mock works), then:   node scripts/smoke2.mjs
// Optional: MONGO_URI=mongodb://127.0.0.1:27017/ai_assessment node scripts/smoke2.mjs   (also tests deadline expiry)
const BASE = process.env.API || 'http://localhost:5000/api';
const run = Date.now();
let pass = 0;

async function call(method, path, token, body, raw = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL: ${name} ${extra}`); process.exit(1); }
  console.log(`ok   ${name}`); pass++;
};
const reg = async (n) => (await call('POST', '/auth/register', null, { name: `Stu${n}`, email: `stu${n}.${run}@t.com`, password: 'secret123', role: 'student' })).data;
const gen = (token, over = {}) => call('POST', '/practice/generate', token, {
  subjects: ['python'], topics: { python: ['Strings'] }, customSubtopics: {}, difficulty: 'medium', totalQuestions: 5, ...over,
});

const s1 = await reg(1); const s2 = await reg(2);
const t = s1.token;

// ---- auth / catalog ----
check('catalog requires auth', (await call('GET', '/practice/catalog')).status === 401);
const cat = await call('GET', '/practice/catalog', t);
check('catalog lists categories and subjects', cat.data.categories.length >= 4 && cat.data.categories.flatMap((c) => c.subjects).some((s) => s.id === 'python'));
check('student routes blocked without token', (await call('GET', '/student/dashboard')).status === 401);

// ---- input validation (server side) ----
let r = await gen(t, { subjects: [] });
check('empty subject -> spec message', r.status === 400 && /select at least one subject/.test(r.data.message));
r = await gen(t, { topics: { python: [] } });
check('empty topic -> spec message', r.status === 400 && /at least one topic or enter a valid custom subtopic/.test(r.data.message));
for (const bad of [0, -1, 2.5, 'abc', 999]) {
  r = await gen(t, { totalQuestions: bad });
  check(`invalid count ${JSON.stringify(bad)} rejected`, r.status === 400 && /valid number of questions/.test(r.data.message));
}
r = await gen(t, { customSubtopics: { python: 'Cricket' } });
check('unrelated custom subtopic -> Invalid Topic', r.status === 422 && /^Invalid Topic!.*related to Python/.test(r.data.message) && r.data.code === 'INVALID_TOPIC');
r = await gen(t, { customSubtopics: { python: 'Normalization' } });
check('subtopic from another subject (DBMS) rejected for Python', r.status === 422);
r = await gen(t, { customSubtopics: { python: '???' } });
check('gibberish custom input rejected', r.status === 400);

// ---- generation: single, custom subtopics, mixed ----
r = await gen(t, { topics: { python: [] }, customSubtopics: { python: 'Inheritance, Polymorphism\nMethod Overriding' }, difficulty: 'hard', totalQuestions: 6 });
check('custom subtopics accepted; hard => 2 min per question', r.status === 201 && r.data.summary.durationSeconds === 6 * 120);
const mixed = await call('POST', '/practice/generate', t, {
  subjects: ['aptitude', 'reasoning', 'python', 'dbms'],
  topics: { aptitude: ['Percentages'], reasoning: ['Syllogisms'], python: ['Strings'], dbms: ['SQL'] },
  customSubtopics: {}, difficulty: 'mixed', totalQuestions: 20,
});
check('mixed 4-subject test has exactly 20 questions', mixed.status === 201 && mixed.data.summary.totalQuestions === 20
  && Object.values(mixed.data.summary.bySubject).every((n) => n === 5));
const by = mixed.data.summary.byDifficulty;
check('mixed duration = sum of per-question allotments', mixed.data.summary.durationSeconds === (by.easy || 0) * 60 + (by.medium || 0) * 90 + (by.hard || 0) * 120);
check('manual distribution must sum to total', (await gen(t, { subjects: ['python', 'dbms'], topics: { python: ['Strings'], dbms: ['SQL'] }, totalQuestions: 10, distribution: { python: 5, dbms: 4 } })).status === 400);

// ---- timed attempt ----
const testId = mixed.data.test._id;
check('another student cannot start my practice test', (await call('POST', '/attempts/start', s2.token, { testId })).status === 404);
const st = await call('POST', '/attempts/start', t, { testId });
check('start attempt', st.status === 201 && st.data.attemptId);
const aid = st.data.attemptId;
const again = await call('POST', '/attempts/start', t, { testId });
check('starting again resumes the same attempt', again.data.attemptId === aid && again.data.resumed === true);

const sess = await call('GET', `/attempts/${aid}/session`, t);
const raw = JSON.stringify(sess.data);
check('session has 20 questions with 4 options each', sess.data.questions.length === 20 && sess.data.questions.every((q) => q.options.length === 4));
check('NO correct answers / explanations in the running session', !/correctOption|explanation/.test(raw));
check('deadline set by server', !!sess.data.attempt.deadlineAt && sess.data.attempt.durationSeconds === mixed.data.summary.durationSeconds);
check('review blocked while in progress', (await call('GET', `/attempts/${aid}`, t)).status === 409);
check('other student cannot read my session', (await call('GET', `/attempts/${aid}/session`, s2.token)).status === 404);

const q0 = sess.data.questions[0];
check('autosave accepted', (await call('PUT', `/attempts/${aid}/answers`, t, { answers: [{ questionId: q0._id, selected: 2, marked: true, timeSpentSec: 7 }] })).status === 200);
const sess2 = await call('GET', `/attempts/${aid}/session`, t);
check('refresh: same deadline, same order, saved answer restored', sess2.data.attempt.deadlineAt === sess.data.attempt.deadlineAt
  && sess2.data.questions[0]._id === q0._id && sess2.data.questions[0].options.join('|') === q0.options.join('|')
  && sess2.data.answers.find((a) => a.questionId === q0._id).selected === 2 && sess2.data.answers.find((a) => a.questionId === q0._id).marked === true);
await call('PUT', `/attempts/${aid}/answers`, t, { answers: [{ questionId: q0._id, selected: 99 }, { questionId: 'ffffffffffffffffffffffff', selected: 1 }] });
const sess3 = await call('GET', `/attempts/${aid}/session`, t);
check('tampered answers (bad index / foreign question) are ignored', sess3.data.answers.find((a) => a.questionId === q0._id).selected === 2);

const sub = await call('POST', `/attempts/${aid}/submit`, t, { answers: sess.data.questions.map((q) => ({ questionId: q._id, selected: 0 })) });
check('submit succeeds', sub.status === 200 && sub.data.status === 'submitted');
check('second submit is idempotent', (await call('POST', `/attempts/${aid}/submit`, t, {})).data.alreadySubmitted === true);
check('autosave after submit rejected', (await call('PUT', `/attempts/${aid}/answers`, t, { answers: [] })).status === 409);

const rep = await call('GET', `/attempts/${aid}`, t);
check('report has score, explanations and correct answers after submit', rep.status === 200 && rep.data.review.length === 20
  && rep.data.review.every((x) => typeof x.correctOption === 'number' && typeof x.explanation === 'string') && rep.data.attempt.total === 20);
check('score equals number of correct review rows', rep.data.attempt.score === rep.data.review.filter((x) => x.isCorrect).length);
check('other student cannot open my report', (await call('GET', `/attempts/${aid}`, s2.token)).status === 404);
check('other student cannot download my PDF', (await call('GET', `/student/reports/${aid}/pdf`, s2.token)).status === 404);
const pdf = await call('GET', `/student/reports/${aid}/pdf`, t, undefined, true);
check('PDF download (needs pdfkit installed)', pdf.status === 200 && /pdf/.test(pdf.headers.get('content-type')) && (await pdf.arrayBuffer()).byteLength > 1000);

// ---- reports / dashboard / performance ----
const list = await call('GET', '/student/reports', t);
check('reports list contains the attempt', list.data.total === 1 && list.data.reports[0]._id === aid && list.data.reports[0].subjects.length === 4);
check('filter by subject works', (await call('GET', '/student/reports?subject=python', t)).data.total === 1 && (await call('GET', '/student/reports?subject=cn', t)).data.total === 0);
check('filter by difficulty/status/date works', (await call('GET', '/student/reports?difficulty=hard&status=submitted', t)).data.total === 1
  && (await call('GET', '/student/reports?status=auto_submitted', t)).data.total === 0
  && (await call('GET', '/student/reports?from=2999-01-01', t)).data.total === 0);
check('bad filter values rejected', (await call('GET', '/student/reports?from=notadate', t)).status === 400 && (await call('GET', '/student/reports?difficulty=zzz', t)).status === 400);
check('other student sees none of my reports', (await call('GET', '/student/reports', s2.token)).data.total === 0);
const dash = await call('GET', '/student/dashboard', t);
check('dashboard overview from real data', dash.data.totalAttempts === 1 && dash.data.recent.length === 1 && dash.data.recent[0].attemptId === aid);
const perf = await call('GET', '/student/performance', t);
check('performance has subjects/topics/difficulty from saved attempt', perf.data.subjects.length === 4 && perf.data.topics.length >= 4 && perf.data.difficulties.length >= 1 && perf.data.trend.length === 1);
check('AI analysis endpoint works with data', (await call('POST', '/student/performance/analysis', t)).data.text?.length > 20);
check('AI analysis refuses with no data', (await call('POST', '/student/performance/analysis', s2.token)).status === 400);

// ---- deadline expiry (needs direct DB access) ----
if (process.env.MONGO_URI) {
  const { default: mongoose } = await import('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const g = await gen(t, { totalQuestions: 5 });
  const a2 = (await call('POST', '/attempts/start', t, { testId: g.data.test._id })).data.attemptId;
  const s = await call('GET', `/attempts/${a2}/session`, t);
  await call('PUT', `/attempts/${a2}/answers`, t, { answers: [{ questionId: s.data.questions[0]._id, selected: 1 }] });
  await mongoose.connection.collection('attempts').updateOne({ _id: new mongoose.Types.ObjectId(a2) }, { $set: { deadlineAt: new Date(Date.now() - 60000) } });
  const late = await call('PUT', `/attempts/${a2}/answers`, t, { answers: [{ questionId: s.data.questions[1]._id, selected: 1 }] });
  check('autosave after deadline is rejected (EXPIRED)', late.status === 409 && late.data.code === 'EXPIRED');
  const fin = await call('GET', `/attempts/${a2}`, t);
  check('expired attempt was auto-submitted with only previously saved answers', fin.data.attempt.status === 'auto_submitted' && fin.data.review.filter((x) => x.selected !== null).length <= 1);
  const a3 = (await call('POST', '/attempts/start', t, { testId: (await gen(t, { totalQuestions: 5 })).data.test._id })).data.attemptId;
  await mongoose.connection.collection('attempts').updateOne({ _id: new mongoose.Types.ObjectId(a3) }, { $set: { deadlineAt: new Date(Date.now() - 60000) } });
  const late2 = await call('POST', `/attempts/${a3}/submit`, t, { answers: [] });
  check('manual submit after deadline closes attempt as auto_submitted', late2.data.expired === true && late2.data.status === 'auto_submitted');
  const s4 = await call('GET', `/attempts/${a3}/session`, t);
  check('session after expiry says finished', s4.data.finished === true);
  await mongoose.disconnect();
} else {
  console.log('skip deadline-expiry checks (set MONGO_URI to run them)');
}

// ---- account ----
check('weak new password rejected', (await call('POST', '/account/password', t, { currentPassword: 'secret123', newPassword: 'short' })).status === 400);
check('wrong current password rejected', (await call('POST', '/account/password', t, { currentPassword: 'nope', newPassword: 'newsecret123' })).status === 403);
check('profile name update', (await call('PATCH', '/account/profile', t, { name: 'Renamed Student' })).data.user.name === 'Renamed Student');
check('email change needs password', (await call('PATCH', '/account/profile', t, { email: `new.${run}@t.com` })).status === 403);
check('preferences saved', (await call('PATCH', '/account/preferences', t, { weeklySummary: true })).data.preferences.weeklySummary === true);
await new Promise((r2) => setTimeout(r2, 1100)); // token iat has 1s resolution
const pw = await call('POST', '/account/password', t, { currentPassword: 'secret123', newPassword: 'newsecret123' });
check('password changed, fresh token returned', pw.status === 200 && pw.data.token);
check('old token is invalidated', (await call('GET', '/student/dashboard', t)).status === 401);
check('new token works', (await call('GET', '/student/dashboard', pw.data.token)).status === 200);
check('login with new password', (await call('POST', '/auth/login', null, { email: `stu1.${run}@t.com`, password: 'newsecret123' })).status === 200);
check('account deletion needs correct password', (await call('DELETE', '/account', pw.data.token, { password: 'wrong' })).status === 403);
check('account deletion works', (await call('DELETE', '/account', pw.data.token, { password: 'newsecret123' })).status === 200);
check('deleted account cannot log in', (await call('POST', '/auth/login', null, { email: `stu1.${run}@t.com`, password: 'newsecret123' })).status === 401);

console.log(`\nAll ${pass} checks passed.`);
