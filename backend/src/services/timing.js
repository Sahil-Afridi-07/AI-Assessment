// Server-authoritative timing. The browser countdown is only a display; these functions decide.
const GRACE_MS = 5000; // tolerance for network latency on the final autosave/submit

const deadlineFor = (startedAt, durationSec) =>
  durationSec > 0 ? new Date(new Date(startedAt).getTime() + durationSec * 1000) : null;

// An attempt without a deadline (untimed teacher/company tests, legacy data) never expires.
function isExpired(deadlineAt, now = Date.now(), graceMs = GRACE_MS) {
  if (!deadlineAt) return false;
  return now > new Date(deadlineAt).getTime() + graceMs;
}

const secondsRemaining = (deadlineAt, now = Date.now()) =>
  deadlineAt ? Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000)) : null;

// Client-reported per-question time is untrusted: clamp to [0, elapsed since start].
function clampTimeSpent(reportedSec, startedAt, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const n = Number(reportedSec);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), elapsed);
}

module.exports = { GRACE_MS, deadlineFor, isExpired, secondsRemaining, clampTimeSpent };
