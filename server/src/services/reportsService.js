const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const analytics = require('./analyticsService');
const detection = require('./detectionService');
const activityService = require('./activityService');
const { startOfMonthUTC, endOfMonthUTC, addMonthsUTC, startOfDayUTC, monthKey, shortMonthLabel, dayLabel, lastMonths } = require('../utils/date');
const { round2, percentChange, median } = require('../utils/number');

const oid = (v) => new mongoose.Types.ObjectId(String(v));

const resolveRange = ({ from, to, month } = {}) => {
  if (month) {
    const m = /^\d{4}-\d{2}$/.test(month) ? new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1)) : new Date(month);
    return { from: startOfMonthUTC(m), to: endOfMonthUTC(m) };
  }
  const toDate = to ? endOfMonthUTC(new Date(to)) : endOfMonthUTC(new Date());
  const fromDate = from ? startOfDayUTC(new Date(from)) : startOfMonthUTC(addMonthsUTC(toDate, -5));
  return { from: fromDate, to: toDate };
};

/** Full report payload behind /api/reports. */
async function build(user, { from, to, month, categoryId, type, currency = '$', useAi = false } = {}) {
  const range = resolveRange({ from, to, month });
  const match = { user: oid(user._id), date: { $gte: range.from, $lte: range.to } };
  if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) match.category = oid(categoryId);
  if (type && ['income', 'expense'].includes(type)) match.type = type;

  const [totals, byCategory, byDay, byMonth, biggest, countByType, categories] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 }, avg: { $avg: '$amount' }, max: { $max: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'categories', localField: '_id.category', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      {
        $project: {
          _id: 0,
          categoryId: '$category._id',
          name: '$category.name',
          color: '$category.color',
          icon: '$category.icon',
          type: '$_id.type',
          total: { $round: ['$total', 2] },
          count: 1,
        },
      },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]),
    Transaction.find(match).populate('category', 'name color icon').sort({ amount: -1 }).limit(10).lean(),
    Transaction.aggregate([{ $match: match }, { $group: { _id: '$type', amount: { $push: '$amount' } } }]),
    Category.find({ user: user._id }).select('name color icon type').lean(),
  ]);

  const income = round2(totals.find((t) => t._id === 'income')?.total || 0);
  const expense = round2(totals.find((t) => t._id === 'expense')?.total || 0);
  const txCount = totals.reduce((s, t) => s + t.count, 0);
  const expenseByCategory = byCategory.filter((c) => c.type === 'expense');
  const incomeByCategory = byCategory.filter((c) => c.type === 'income');

  // Six-month context (always relative to the selected range end).
  const trend = await analytics.monthlyTrend(user._id, 6, range.to);

  // Daily / weekly summaries for the *selected* range's last month.
  const focusMonth = startOfMonthUTC(range.to);
  const focusDaily = byDay
    .filter((d) => new Date(`${d._id}T00:00:00.000Z`) >= focusMonth)
    .map((d) => ({ date: d._id, label: dayLabel(d._id), income: round2(d.income), expense: round2(d.expense), count: d.count }));
  const weekly = analytics.weeklyBuckets(focusMonth, focusDaily.length ? focusDaily : [{ date: focusMonth.toISOString().slice(0, 10), income: 0, expense: 0, count: 0, label: '' }]);

  const budgetPerformance = await analytics.budgetPerformance(user._id, focusMonth, currency);
  const averages = await analytics.categoryAverages(user._id, 3, range.to);
  const anomalyCount = await Transaction.countDocuments({ ...match, isAnomaly: true });

  const expenseMedian = median((countByType.find((c) => c._id === 'expense')?.amount || []));
  const largest = biggest[0]
    ? {
        id: biggest[0]._id,
        amount: round2(biggest[0].amount),
        description: biggest[0].description,
        date: biggest[0].date,
        categoryName: biggest[0].category?.name || '',
        type: biggest[0].type,
      }
    : null;

  return {
    range: { from: range.from, to: range.to, label: `${shortMonthLabel(range.from)} – ${shortMonthLabel(range.to)}` },
    filters: { categoryId: categoryId || null, type: type || null, currency },
    overview: {
      income,
      expense,
      net: round2(income - expense),
      savingsRate: income ? round2(((income - expense) / income) * 100) : 0,
      transactionCount: txCount,
      averageTransaction: txCount ? round2((income + expense) / txCount) : 0,
      medianExpense: round2(expenseMedian),
      largest,
      anomalyCount,
      categoriesUsed: expenseByCategory.length,
      monthsCovered: byMonth.length ? [...new Set(byMonth.map((m) => m._id.month))].length : 0,
    },
    byCategory: { expense: expenseByCategory, income: incomeByCategory },
    byMonth: lastMonths(6, range.to).map((m) => {
      const key = monthKey(m);
      const incomeRow = byMonth.find((r) => r._id.month === key && r._id.type === 'income');
      const expenseRow = byMonth.find((r) => r._id.month === key && r._id.type === 'expense');
      return {
        key,
        label: shortMonthLabel(m),
        income: round2(incomeRow?.total || 0),
        expense: round2(expenseRow?.total || 0),
        net: round2((incomeRow?.total || 0) - (expenseRow?.total || 0)),
        count: (incomeRow?.count || 0) + (expenseRow?.count || 0),
      };
    }),
    sixMonthTrend: trend,
    daily: byDay.map((d) => ({ date: d._id, label: dayLabel(d._id), income: round2(d.income), expense: round2(d.expense), count: d.count })),
    weekly,
    budgets: budgetPerformance,
    averages,
    categories,
  };
}

/** Stable ObjectId derived from a string seed (so re-saving updates, not duplicates). */
const deterministicId = (seed) => {
  const hash = require('crypto').createHash('md5').update(String(seed)).digest('hex');
  return new mongoose.Types.ObjectId(hash.slice(0, 24));
};

/**
 * Save a snapshot of the current report as a bookmark so the student can
 * revisit or share the summary later. Re-saving the same range updates the
 * existing bookmark instead of piling up copies.
 */
async function saveSummary(user, { note = '', rangeLabel = '', overview = {}, filters = {} }) {
  const Bookmark = require('../models/Bookmark');
  const body = `Income ${overview.income} · Expenses ${overview.expense} · Net ${overview.net} (${rangeLabel})`;
  const bookmark = await Bookmark.findOneAndUpdate(
    { user: user._id, itemType: 'report', itemId: deterministicId(`${user._id}:${rangeLabel}`) },
    {
      $set: {
        title: `Report snapshot — ${rangeLabel}`,
        body,
        meta: { note, overview, filters, rangeLabel, savedAt: new Date() },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await activityService.logActivity({
    user: user._id, action: 'export', entity: 'report', label: `Saved report summary (${rangeLabel})`, meta: { rangeLabel },
  });
  return bookmark;
}

/** Detect month-over-month movers worth calling out in the report header. */
async function highlightMovers(user, month = new Date()) {
  const increases = await detection.checkSpendingIncrease(user._id, { threshold: 25 });
  const decreases = (await detection.checkSpendingIncrease(user._id, { threshold: -100 })).filter((d) => d.changePercent < -10);
  return { increases, decreases };
}

module.exports = { build, saveSummary, highlightMovers, resolveRange };
