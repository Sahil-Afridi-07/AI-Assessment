// End-to-end API smoke test. Start the server first (npm start), then:  node scripts/smoke.mjs
// Uses the mock AI provider by default. Needs Node 18+.
const BASE = process.env.API || 'http://localhost:5000/api';
const run = Date.now();
let pass = 0;

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
function check(name, cond, extra = '') {
  if (!cond) { console.error(`FAIL: ${name} ${extra}`); process.exit(1); }
  console.log(`ok   ${name}`); pass++;
}
const reg = async (role, n) => (await call('POST', '/auth/register', null, { name: `${role}${n}`, email: `${role}${n}.${run}@t.com`, password: 'secret123', role })).data;

const teacher = await reg('teacher', 1);
const company = await reg('company', 1);
const s1 = await reg('student', 1);
const s2 = await reg('student', 2);
check('register 4 users', teacher.token && company.token && s1.token && s2.token);

// --- RBAC ---
check('student cannot create class test', (await call('POST', '/tests', s1.token, {})).status === 403);
check('teacher cannot use student practice route', (await call('POST', '/tests/practice', teacher.token, { topic: 'x' })).status === 403);
check('no token -> 401', (await call('GET', '/tests/mine')).status === 401);

// --- Student: AI practice test, answers hidden, scoring ---
const practice = await call('POST', '/tests/practice', s1.token, { topic: 'Operating Systems', difficulty: 'easy', count: 4 });
check('student generates AI practice test', practice.status === 201);
const pt = await call('GET', `/tests/${practice.data.test._id}`, s1.token);
check('questions returned WITHOUT correctOption', pt.data.questions.length === 4 && pt.data.questions.every((q) => !('correctOption' in q)));
const sub = await call('POST', '/attempts', s1.token, { testId: practice.data.test._id, answers: pt.data.questions.map((q) => ({ questionId: q._id, selected: 0 })) });
check('submit returns score + feedback + review', sub.status === 201 && sub.data.total === 4 && typeof sub.data.feedback === 'string' && sub.data.review.length === 4);
const rv = sub.data.review;
check('score equals count of correct reviews', sub.data.score === rv.filter((r) => r.isCorrect).length);

// --- Teacher: manual + AI preview, class, assign, analytics ---
const prev = await call('POST', '/ai/questions', teacher.token, { topic: 'DBMS', count: 2 });
check('teacher previews AI questions', prev.status === 200 && prev.data.questions.length === 2);
const manual = { text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correctOption: 1, generatedBy: 'Manual' };
const mk = await call('POST', '/tests', teacher.token, { title: 'Mixed quiz', topic: 'DBMS', questions: [manual, ...prev.data.questions] });
check('teacher creates Mixed test', mk.status === 201 && mk.data.test.source === 'Mixed');
const tid = mk.data.test._id;
const cls = (await call('POST', '/classes', teacher.token, { name: 'Batch A' })).data.class;
check('assign unpublished test is refused', (await call('POST', `/classes/${cls._id}/assign`, teacher.token, { testId: tid })).status === 400);
await call('PATCH', `/tests/${tid}/publish`, teacher.token, {});
const addRes = await call('POST', `/classes/${cls._id}/students`, teacher.token, { emails: [`student1.${run}@t.com`, 'nobody@t.com'] });
check('add student by email (unknown reported)', addRes.data.added === 1 && addRes.data.notFound.length === 1);
check('assign published test', (await call('POST', `/classes/${cls._id}/assign`, teacher.token, { testId: tid })).status === 200);

check('student2 (not in class) cannot open test', (await call('GET', `/tests/${tid}`, s2.token)).status === 404);
const asg = await call('GET', '/tests/assigned', s1.token);
check('student1 sees assigned test', asg.data.tests.some((t) => t._id === tid));
const ct = await call('GET', `/tests/${tid}`, s1.token);
const answers = ct.data.questions.map((q, i) => ({ questionId: q._id, selected: i === 0 ? 1 : 0 }));
const cs = await call('POST', '/attempts', s1.token, { testId: tid, answers });
check('class test submitted', cs.status === 201);
check('2nd attempt on class test blocked', (await call('POST', '/attempts', s1.token, { testId: tid, answers })).status === 409);
const an = await call('GET', `/classes/${cls._id}/analytics`, teacher.token);
check('class analytics has 1 attempt', an.data.totalAttempts === 1 && an.data.perStudent.length === 1);
check('teacher can open student attempt', (await call('GET', `/attempts/${cs.data.attemptId}`, teacher.token)).status === 200);
check('other student cannot open attempt', (await call('GET', `/attempts/${cs.data.attemptId}`, s2.token)).status === 404);

// --- Company: screening test, invite, ranked results ---
const q = { text: 'Which is a JS framework?', options: ['React', 'Rust', 'Redis', 'Ruby'], correctOption: 0 };
const st = (await call('POST', '/tests', company.token, { title: 'Screen', topic: 'JS', questions: [q] })).data.test;
await call('PATCH', `/tests/${st._id}/publish`, company.token, {});
const role = (await call('POST', '/jobroles', company.token, { roleName: 'Frontend Dev' })).data.jobRole;
await call('POST', `/jobroles/${role._id}/tests`, company.token, { testId: st._id });
await call('POST', `/jobroles/${role._id}/invite`, company.token, { emails: [`student1.${run}@t.com`, `student2.${run}@t.com`] });
for (const [tok, pick] of [[s1.token, 0], [s2.token, 1]]) {
  const t = await call('GET', `/tests/${st._id}`, tok);
  await call('POST', '/attempts', tok, { testId: st._id, answers: [{ questionId: t.data.questions[0]._id, selected: pick }] });
}
const res = await call('GET', `/jobroles/${role._id}/results`, company.token);
check('ranking: student1 (100%) ranked #1 above student2 (0%)', res.data.ranked.length === 2 && res.data.ranked[0].rank === 1 && res.data.ranked[0].percentage === 100 && res.data.ranked[1].percentage === 0);
check('teacher cannot see company results', (await call('GET', `/jobroles/${role._id}/results`, teacher.token)).status === 403);

console.log(`\nAll ${pass} checks passed.`);
