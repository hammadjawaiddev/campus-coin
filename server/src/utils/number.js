const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const percentChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return round2(((current - previous) / Math.abs(previous)) * 100);
};

const percentOf = (part, total) => (total ? round2((part / total) * 100) : 0);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const safeDivide = (a, b, fallback = 0) => (b ? a / b : fallback);

module.exports = { round2, percentChange, percentOf, clamp, median, mean, safeDivide };
