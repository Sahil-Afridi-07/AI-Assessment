// Pure helpers: how many questions per subject, which difficulty each gets, test duration.
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const SECONDS_PER_QUESTION = { easy: 60, medium: 90, hard: 120 };
const MAX_QUESTIONS = 30;

// Split `total` across `keys` evenly (remainder goes to the first keys), or validate a manual split.
// Returns { ok, counts: {key: n}, error }.
function allocateCounts(keys, total, manual) {
  if (!Number.isInteger(total) || total < 1 || total > MAX_QUESTIONS) return { ok: false, error: 'COUNT' };
  if (!keys.length) return { ok: false, error: 'NO_KEYS' };
  if (keys.length > total) return { ok: false, error: 'TOO_MANY_KEYS' }; // each subject needs >= 1 question
  if (manual && Object.keys(manual).length) {
    const counts = {};
    let sum = 0;
    for (const k of keys) {
      const n = manual[k];
      if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'MANUAL_INVALID' };
      counts[k] = n;
      sum += n;
    }
    if (sum !== total) return { ok: false, error: 'MANUAL_SUM' };
    return { ok: true, counts };
  }
  const base = Math.floor(total / keys.length);
  let rem = total % keys.length;
  const counts = {};
  for (const k of keys) counts[k] = base + (rem-- > 0 ? 1 : 0);
  return { ok: true, counts };
}

// Difficulty for each of `count` questions. 'mixed' = ~40% easy, ~40% medium, ~20% hard.
function difficultyPlan(count, mode) {
  if (DIFFICULTIES.includes(mode)) return Array(count).fill(mode);
  const hard = Math.round(count * 0.2);
  const easy = Math.round(count * 0.4);
  const medium = count - hard - easy;
  return [...Array(easy).fill('easy'), ...Array(medium).fill('medium'), ...Array(hard).fill('hard')];
}

// Deal the global difficulty list out to subjects so each subject gets a balanced mix.
// Returns { subjectKey: ['easy','hard',...] } with exactly counts[key] entries each.
function dealDifficulties(counts, mode) {
  const keys = Object.keys(counts);
  const total = keys.reduce((s, k) => s + counts[k], 0);
  const plan = difficultyPlan(total, mode);
  const remaining = { ...counts };
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  let i = 0;
  while (i < plan.length) {
    for (const k of keys) {
      if (i >= plan.length) break;
      if (remaining[k] > 0) { out[k].push(plan[i++]); remaining[k]--; }
    }
  }
  return out;
}

const secondsFor = (difficulty) => SECONDS_PER_QUESTION[difficulty] || SECONDS_PER_QUESTION.medium;

// Duration = sum of per-question allotments (e.g. 5 easy + 10 medium + 5 hard = 30 min).
function totalDurationSeconds(questions) {
  return questions.reduce((s, q) => s + secondsFor(q.difficulty), 0);
}

function countBy(items, key) {
  const m = {};
  for (const it of items) m[it[key]] = (m[it[key]] || 0) + 1;
  return m;
}

module.exports = { DIFFICULTIES, SECONDS_PER_QUESTION, MAX_QUESTIONS, allocateCounts, difficultyPlan, dealDifficulties, secondsFor, totalDurationSeconds, countBy };
