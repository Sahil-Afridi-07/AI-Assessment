// Pure analytics helpers (no DB access) so they can be tested in isolation.

// Rank candidates: higher percentage first; earlier submission wins ties.
function rankCandidates(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });
  let lastPct = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    const rank = r.percentage === lastPct ? lastRank : i + 1;
    lastPct = r.percentage;
    lastRank = rank;
    return { ...r, rank };
  });
}

// attempts: [{ studentId, testId, score, total, percentage, topicBreakdown }]
function classAnalytics(attempts, students) {
  const n = attempts.length;
  const avg = n ? attempts.reduce((s, a) => s + a.percentage, 0) / n : 0;

  const perStudent = students.map((s) => {
    const mine = attempts.filter((a) => String(a.studentId) === String(s.id));
    const avgPct = mine.length ? mine.reduce((t, a) => t + a.percentage, 0) / mine.length : null;
    return {
      studentId: s.id,
      name: s.name,
      email: s.email,
      attempts: mine.length,
      averagePercentage: avgPct === null ? null : Math.round(avgPct * 100) / 100,
    };
  });

  const topicMap = new Map();
  for (const a of attempts) {
    for (const t of a.topicBreakdown || []) {
      const row = topicMap.get(t.topic) || { topic: t.topic, correct: 0, total: 0 };
      row.correct += t.correct;
      row.total += t.total;
      topicMap.set(t.topic, row);
    }
  }
  const topics = [...topicMap.values()]
    .map((t) => ({ ...t, accuracy: t.total ? Math.round((t.correct / t.total) * 10000) / 100 : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy); // weakest first

  const dist = { '0-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 };
  for (const a of attempts) {
    if (a.percentage < 40) dist['0-39']++;
    else if (a.percentage < 60) dist['40-59']++;
    else if (a.percentage < 80) dist['60-79']++;
    else dist['80-100']++;
  }

  return {
    totalAttempts: n,
    averagePercentage: Math.round(avg * 100) / 100,
    distribution: dist,
    perStudent,
    weakestTopics: topics.slice(0, 5),
    topics,
  };
}

// Student progress: per-topic accuracy across all attempts.
function progressByTopic(attempts) {
  const m = new Map();
  for (const a of attempts) {
    for (const t of a.topicBreakdown || []) {
      const r = m.get(t.topic) || { topic: t.topic, correct: 0, total: 0 };
      r.correct += t.correct;
      r.total += t.total;
      m.set(t.topic, r);
    }
  }
  return [...m.values()].map((r) => ({
    ...r,
    accuracy: r.total ? Math.round((r.correct / r.total) * 10000) / 100 : 0,
  }));
}

module.exports = { rankCandidates, classAnalytics, progressByTopic };
