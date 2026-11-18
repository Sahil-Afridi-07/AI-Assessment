// Pure merge of client-sent answers (DISPLAYED option indexes) into a stored attempt (ORIGINAL indexes).
// Unknown question ids are ignored, out-of-range indexes are ignored (the previous answer is kept),
// and client-reported time is clamped. No database access, so it is unit-testable.
const { displayedToOriginal, isPermutation } = require('./shuffle');
const { clampTimeSpent } = require('./timing');

function mergeAnswers(attempt, incoming, now = Date.now()) {
  const orders = new Map((attempt.optionOrders || []).map((o) => [String(o.questionId), o.order]));
  const allowed = new Set((attempt.questionOrder || []).map(String));
  const current = new Map((attempt.answers || []).map((a) => [String(a.questionId), { ...(a.toObject ? a.toObject() : a) }]));

  for (const a of Array.isArray(incoming) ? incoming.slice(0, 100) : []) {
    if (!a || !allowed.has(String(a.questionId))) continue;
    const order = orders.get(String(a.questionId));
    if (!isPermutation(order)) continue;
    const prev = current.get(String(a.questionId)) || { questionId: a.questionId, selected: null, marked: false, timeSpentSec: 0 };
    if ('selected' in a) {
      if (a.selected === null) prev.selected = null; // "clear my answer"
      else {
        const original = displayedToOriginal(order, a.selected);
        if (original !== null) prev.selected = original; // invalid index: keep what was saved
      }
    }
    if ('marked' in a) prev.marked = a.marked === true;
    if ('timeSpentSec' in a) prev.timeSpentSec = Math.max(prev.timeSpentSec || 0, clampTimeSpent(a.timeSpentSec, attempt.startedAt, now));
    current.set(String(a.questionId), prev);
  }
  attempt.answers = [...current.values()];
  attempt.lastSavedAt = new Date(now);
}

module.exports = { mergeAnswers };
