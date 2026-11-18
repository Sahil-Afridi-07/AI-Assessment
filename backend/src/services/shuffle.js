// Per-attempt shuffling with a stored permutation, so the server can always map
// the displayed option back to the original one (and the correct answer stays correct).
const crypto = require('crypto');

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// order[displayedIndex] = originalIndex
const makeOptionOrder = () => shuffled([0, 1, 2, 3]);
const displayedToOriginal = (order, displayed) =>
  Number.isInteger(displayed) && displayed >= 0 && displayed < order.length ? order[displayed] : null;
const originalToDisplayed = (order, original) => {
  if (!Number.isInteger(original)) return null;
  const i = order.indexOf(original);
  return i === -1 ? null : i;
};
const isPermutation = (order) =>
  Array.isArray(order) && order.length === 4 && [0, 1, 2, 3].every((n) => order.includes(n));

module.exports = { shuffled, makeOptionOrder, displayedToOriginal, originalToDisplayed, isPermutation };
