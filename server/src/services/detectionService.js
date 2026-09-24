const Transaction = require('../models/Transaction');
const analytics = require('./analyticsService');
const { startOfMonthUTC, addDays } = require('../utils/date');
const { round2, median, mean, safeDivide } = require('../utils/number');

/**
 * Smart (non-blocking) transaction detection:
 *   • unusually large amounts compared to the student's own category history
 *   • likely duplicates (same amount + type within a short window)
 *   • a category that is accelerating fast this month
 *
 * Everything returns advice only — the caller never blocks a save on it.
 */

const LARGE_MULTIPLIER = 2.5; // vs category mean
const DUPLICATE_WINDOW_DAYS = 3;

async function categoryStats(userId, categoryId, { excludeId = null, months = 6 } = {}) {
  const since = startOfMonthUTC(addDays(new Date(), -months * 30));
  const match = { user: userId, category: categoryId, type: 'expense', date: { $gte: since } };
  if (excludeId) match._id = { $ne: excludeId };

  const rows = await Transaction.find(match).select('amount date').lean();
  const amounts = rows.map((r) => r.amount).filter((a) => a > 0);
  return {
    count: amounts.length,
    mean: round2(mean(amounts)),
    median: round2(median(amounts)),
    max: amounts.length ? round2(Math.max(...amounts)) : 0,
    amounts,
  };
}

/**
 * @returns {{isAnomaly:boolean, reason:string, score:number|null, multiple:number|null}}
 */
async function checkLargeTransaction({ userId, categoryId, amount, type = 'expense', excludeId = null }) {
  if (type !== 'expense') return { isAnomaly: false, reason: '', score: null, multiple: null };

  const stats = await categoryStats(userId, categoryId, { excludeId });
  // Not enough history yet → only compare against an absolute floor.
  if (stats.count < 5) {
    const isBig = amount >= 120;
    return {
      isAnomaly: isBig,
      reason: isBig ? 'This is a large amount compared with the transactions logged so far.' : '',
      score: isBig ? 0.5 : null,
      multiple: null,
    };
  }

  const reference = Math.max(stats.mean, stats.median);
  const multiple = safeDivide(amount, reference);
  const isAnomaly = multiple >= LARGE_MULTIPLIER && amount - reference > 5;
  return {
    isAnomaly,
    reason: isAnomaly
      ? `This transaction is ${round2(multiple)}x higher than your usual spend in this category (average ${round2(reference)}).`
      : '',
    score: round2(Math.min(1, multiple / (LARGE_MULTIPLIER * 2))),
    multiple: round2(multiple),
    reference: reference ? round2(reference) : null,
  };
}

/** Same amount + type within a few days is almost always a double entry. */
async function checkDuplicate({ userId, amount, type, date, description = '', excludeId = null }) {
  const windowStart = addDays(new Date(date), -DUPLICATE_WINDOW_DAYS);
  const windowEnd = addDays(new Date(date), DUPLICATE_WINDOW_DAYS);

  const match = {
    user: userId,
    type,
    amount: { $gte: amount - 0.01, $lte: amount + 0.01 },
    date: { $gte: windowStart, $lte: windowEnd },
  };
  if (excludeId) match._id = { $ne: excludeId };

  const candidates = await Transaction.find(match).populate('category', 'name').select('amount description date category').limit(5).lean();
  if (!candidates.length) return { isDuplicate: false, matches: [] };

  const exact = candidates.filter((c) => (c.description || '').toLowerCase().trim() === (description || '').toLowerCase().trim());
  return {
    isDuplicate: true,
    matches: candidates.map((c) => ({
      id: c._id,
      amount: c.amount,
      date: c.date,
      description: c.description,
      categoryName: c.category?.name || '',
      identicalDescription: exact.some((e) => String(e._id) === String(c._id)),
    })),
    reason: exact.length
      ? 'An identical transaction exists in the same period — this may be a double entry.'
      : 'A transaction with the same amount and type was logged in the last few days.',
  };
}

/** Categories whose current-month spend is well above the recent average. */
async function checkSpendingIncrease(userId, { threshold = 40 } = {}) {
  const monthStart = startOfMonthUTC(new Date());
  const [current, averages] = await Promise.all([
    analytics.monthlyBreakdown(userId, monthStart),
    analytics.categoryAverages(userId, 3, monthStart),
  ]);
  const avgByName = new Map(averages.map((a) => [a.name, a.monthlyAverage]));

  return current.expenseByCategory
    .map((cat) => {
      const average = avgByName.get(cat.name) || 0;
      if (!average) return null;
      const change = round2(((cat.total - average) / average) * 100);
      return change >= threshold && cat.total - average > 5
        ? { categoryId: cat.categoryId, categoryName: cat.name, current: cat.total, average: round2(average), changePercent: change, delta: round2(cat.total - average) }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.delta - a.delta);
}

/** Lightweight next-month forecast from the last 3 complete months. */
async function forecastNextMonth(userId) {
  const trend = await analytics.monthlyTrend(userId, 4);
  const completed = trend.slice(0, -1).filter((t) => t.expense > 0);
  if (completed.length < 2) return null;
  const weights = completed.map((_, i) => i + 1); // recent months weigh more
  const weighted = completed.reduce((sum, t, i) => sum + t.expense * weights[i], 0) / weights.reduce((a, b) => a + b, 0);
  const avgIncome = completed.reduce((s, t) => s + t.income, 0) / completed.length;
  return {
    forecastExpense: round2(weighted),
    forecastIncome: round2(avgIncome),
    forecastNet: round2(avgIncome - weighted),
    basedOnMonths: completed.length,
    confidence: completed.length >= 3 ? 'medium' : 'low',
  };
}

module.exports = {
  checkLargeTransaction,
  checkDuplicate,
  checkSpendingIncrease,
  forecastNextMonth,
  categoryStats,
  LARGE_MULTIPLIER,
  DUPLICATE_WINDOW_DAYS,
};
