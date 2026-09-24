const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const {
  startOfMonthUTC,
  endOfMonthUTC,
  startOfDayUTC,
  endOfDayUTC,
  addMonthsUTC,
  monthKey,
  shortMonthLabel,
  dayLabel,
  daysBetween,
} = require('../utils/date');
const { round2, percentChange, percentOf, median, safeDivide } = require('../utils/number');

const oid = (value) => new mongoose.Types.ObjectId(String(value));

/**
 * Totals + per-category breakdown for a single month.
 * `endOverride` lets callers restrict the window (used for month-to-date
 * comparisons against the same period of the previous month).
 */
async function monthlyBreakdown(userId, month, { categoryId = null, endOverride = null } = {}) {
  const from = startOfMonthUTC(month);
  const to = endOverride && new Date(endOverride) < endOfMonthUTC(month) ? new Date(endOverride) : endOfMonthUTC(month);
  const match = { user: oid(userId), date: { $gte: from, $lte: to } };
  if (categoryId) match.category = oid(categoryId);

  const [totals, byCategory, daily] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 }, avg: { $avg: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { category: '$category', type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          max: { $max: '$amount' },
        },
      },
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
          max: { $round: ['$max', 2] },
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
  ]);

  const income = round2(totals.find((t) => t._id === 'income')?.total || 0);
  const expense = round2(totals.find((t) => t._id === 'expense')?.total || 0);
  const txCount = totals.reduce((sum, t) => sum + t.count, 0);
  const avgExpense = round2(totals.find((t) => t._id === 'expense')?.avg || 0);

  // Shares are attached to the same objects `topCategory` points at, so widgets
  // can display "Food · 51% of spend" without recomputing anything.
  const expenseByCategory = byCategory.filter((c) => c.type === 'expense').map((c) => ({ ...c, share: percentOf(c.total, expense) }));
  const incomeByCategory = byCategory.filter((c) => c.type === 'income').map((c) => ({ ...c, share: percentOf(c.total, income) }));

  return {
    month,
    monthKey: monthKey(month),
    monthLabel: shortMonthLabel(month),
    income,
    expense,
    net: round2(income - expense),
    savingsRate: income ? round2(((income - expense) / income) * 100) : 0,
    transactionCount: txCount,
    averageExpense: avgExpense,
    byCategory,
    expenseByCategory,
    incomeByCategory,
    topCategory: expenseByCategory[0] || null,
    daily: daily.map((d) => ({ date: d._id, label: dayLabel(d._id), income: round2(d.income), expense: round2(d.expense), count: d.count })),
  };
}

/** Income / expense / net for N months ending at `end` — powers trend charts. */
async function monthlyTrend(userId, months = 6, end = new Date()) {
  const endMonth = startOfMonthUTC(end);
  const from = addMonthsUTC(endMonth, -(months - 1));

  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), date: { $gte: from, $lte: endOfMonthUTC(endMonth) } } },
    {
      $group: {
        _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = new Map();
  rows.forEach((r) => {
    const entry = map.get(r._id.month) || { income: 0, expense: 0, count: 0 };
    entry[r._id.type] = round2(r.total);
    entry.count += r.count;
    map.set(r._id.month, entry);
  });

  return Array.from({ length: months }, (_, i) => {
    const d = addMonthsUTC(from, i);
    const key = monthKey(d);
    const entry = map.get(key) || { income: 0, expense: 0, count: 0 };
    return {
      month: d,
      key,
      label: shortMonthLabel(d),
      income: round2(entry.income),
      expense: round2(entry.expense),
      net: round2(entry.income - entry.expense),
      savingsRate: entry.income ? round2(((entry.income - entry.expense) / entry.income) * 100) : 0,
      count: entry.count,
    };
  });
}

/** Week-by-week buckets (Mon-start) for a single month. */
function weeklyBuckets(month, daily) {
  const from = startOfMonthUTC(month);
  const to = endOfMonthUTC(month);
  const totalDays = daysBetween(from, to) + 1;
  const buckets = [];

  const offsetToMonday = (from.getUTCDay() + 6) % 7; // 0 = Monday
  let cursor = new Date(from);
  cursor = new Date(cursor.getTime() - offsetToMonday * 86400000);

  for (let i = 0; i < Math.ceil((totalDays + offsetToMonday) / 7); i += 1) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor.getTime() + 6 * 86400000);
    const clipStart = weekStart < from ? from : weekStart;
    const clipEnd = weekEnd > to ? to : weekEnd;

    const inWeek = daily.filter((d) => {
      const day = new Date(`${d.date}T00:00:00.000Z`);
      return day >= clipStart && day <= clipEnd;
    });

    const income = round2(inWeek.reduce((s, d) => s + d.income, 0));
    const expense = round2(inWeek.reduce((s, d) => s + d.expense, 0));
    buckets.push({
      index: i + 1,
      label: `W${i + 1}`,
      range: `${clipStart.getUTCDate()}–${clipEnd.getUTCDate()} ${shortMonthLabel(clipEnd)}`,
      start: clipStart,
      end: clipEnd,
      income,
      expense,
      net: round2(income - expense),
      count: inWeek.reduce((s, d) => s + d.count, 0),
    });

    cursor = new Date(cursor.getTime() + 7 * 86400000);
  }
  return buckets;
}

/** Budgets for a month joined with actual spend, plus status + alerts. */
async function budgetPerformance(userId, month, userCurrency = '$') {
  const monthStart = startOfMonthUTC(month);
  const monthEnd = endOfMonthUTC(month);

  const budgets = await Budget.find({ user: userId, month: monthStart }).populate('category', 'name color icon type').sort({ limitAmount: -1 }).lean();

  const spend = await Transaction.aggregate([
    { $match: { user: oid(userId), type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const spendMap = new Map(spend.map((s) => [String(s._id), { total: round2(s.total), count: s.count }]));

  const rows = budgets
    .filter((b) => b.category)
    .map((b) => {
      const actual = spendMap.get(String(b.category._id)) || { total: 0, count: 0 };
      const spent = round2(actual.total);
      const limit = round2(b.limitAmount);
      const percentUsed = percentOf(spent, limit);
      const remaining = round2(limit - spent);
      let status = 'safe';
      if (percentUsed >= 100) status = 'over';
      else if (percentUsed >= (b.alertThreshold || 80)) status = 'near';
      return {
        id: b._id,
        categoryId: b.category._id,
        categoryName: b.category.name,
        color: b.category.color,
        icon: b.category.icon,
        limit,
        spent,
        remaining,
        percentUsed,
        transactionCount: actual.count,
        status,
        alertThreshold: b.alertThreshold,
        month: b.month,
        note: b.note,
        currency: userCurrency,
      };
    });

  const totalLimit = round2(rows.reduce((s, r) => s + r.limit, 0));
  const totalSpent = round2(rows.reduce((s, r) => s + r.spent, 0));

  return {
    month: monthStart,
    rows,
    summary: {
      totalLimit,
      totalSpent,
      totalRemaining: round2(totalLimit - totalSpent),
      percentUsed: percentOf(totalSpent, totalLimit),
      overCount: rows.filter((r) => r.status === 'over').length,
      nearCount: rows.filter((r) => r.status === 'near').length,
      budgetCount: rows.length,
      unbudgetedSpend: round2(
        [...spendMap.entries()].filter(([catId]) => !rows.some((r) => String(r.categoryId) === catId)).reduce((s, [, v]) => s + v.total, 0),
      ),
    },
  };
}

/** Category level averages for the last `months` months (excludes current month). */
async function categoryAverages(userId, months = 3, end = new Date()) {
  const endMonth = startOfMonthUTC(end);
  const from = addMonthsUTC(endMonth, -months);
  const to = endOfMonthUTC(addMonthsUTC(endMonth, -1));

  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), type: 'expense', date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        amounts: { $push: '$amount' },
        months: { $addToSet: { $dateToString: { format: '%Y-%m', date: '$date' } } },
      },
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    {
      $project: {
        _id: 0,
        categoryId: '$category._id',
        name: '$category.name',
        color: '$category.color',
        icon: '$category.icon',
        total: { $round: ['$total', 2] },
        count: 1,
        monthsActive: { $size: '$months' },
        amounts: 1,
      },
    },
  ]);

  return rows.map((r) => ({
    ...r,
    monthlyAverage: round2(safeDivide(r.total, Math.max(1, r.monthsActive))),
    medianAmount: round2(median(r.amounts)),
    averageAmount: round2(r.total / Math.max(1, r.count)),
    amounts: undefined,
  }));
}

/** Headline numbers for the dashboard hero cards. */
async function summaryWithComparisons(userId, month = new Date(), currency = '$') {
  const monthStart = startOfMonthUTC(month);
  const prevStart = addMonthsUTC(monthStart, -1);

  // Month-over-month comparisons mid-month are misleading unless both windows
  // cover the same number of days, so we also compute a "same period" window.
  const isCurrentMonth = monthKey(monthStart) === monthKey(new Date());
  const elapsedEnd = endOfDayUTC(new Date());
  const samePeriodEnd = new Date(Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), new Date().getUTCDate(), 23, 59, 59, 999));

  const [current, previous, previousSamePeriod, trend, allTime] = await Promise.all([
    monthlyBreakdown(userId, monthStart, isCurrentMonth ? { endOverride: elapsedEnd } : {}),
    monthlyBreakdown(userId, prevStart),
    isCurrentMonth ? monthlyBreakdown(userId, prevStart, { endOverride: samePeriodEnd }) : Promise.resolve(null),
    monthlyTrend(userId, 6, monthStart),
    Transaction.aggregate([
      { $match: { user: oid(userId) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          first: { $min: '$date' },
        },
      },
    ]),
  ]);

  const lifetime = {
    income: round2(allTime.find((t) => t._id === 'income')?.total || 0),
    expense: round2(allTime.find((t) => t._id === 'expense')?.total || 0),
    count: allTime.reduce((s, t) => s + t.count, 0),
    since: allTime.reduce((min, t) => (t.first && (!min || t.first < min) ? t.first : min), null),
  };
  lifetime.balance = round2(lifetime.income - lifetime.expense);

  const expenseSeries = trend.map((t) => t.expense).filter((v) => v > 0);
  const avgMonthlyExpense = round2(expenseSeries.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(1, expenseSeries.slice(0, -1).length || 1));

  return {
    currency,
    current: {
      ...current,
      // Full-month comparison (used for chart context) …
      incomeChange: percentChange(current.income, previous.income),
      expenseChange: percentChange(current.expense, previous.expense),
      netChange: percentChange(current.net, previous.net),
      transactionChange: percentChange(current.transactionCount, previous.transactionCount),
      // … and the apples-to-apples month-to-date comparison.
      mtdExpenseChange: previousSamePeriod ? percentChange(current.expense, previousSamePeriod.expense) : null,
      mtdIncomeChange: previousSamePeriod ? percentChange(current.income, previousSamePeriod.income) : null,
      mtdIncome: previousSamePeriod?.income ?? null,
      mtdExpense: previousSamePeriod?.expense ?? null,
      daysElapsed: isCurrentMonth ? new Date().getUTCDate() : new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate(),
      isPartialMonth: isCurrentMonth,
    },
    previous,
    previousSamePeriod,
    lifetime,
    trend,
    averageMonthlyExpense: avgMonthlyExpense,
    monthOverMonthExpense: percentChange(current.expense, previous.expense),
  };
}

/** Six-month category movement: useful for "Food is up 18%" style statements. */
async function categoryTrend(userId, categoryId, months = 6, end = new Date()) {
  const trend = await monthlyTrend(userId, months, end);
  const perMonth = await Promise.all(
    trend.map(async (t) => {
      const rows = await Transaction.aggregate([
        {
          $match: {
            user: oid(userId),
            category: oid(categoryId),
            date: { $gte: startOfMonthUTC(t.month), $lte: endOfMonthUTC(t.month) },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]);
      return { ...t, categoryTotal: round2(rows[0]?.total || 0), categoryCount: rows[0]?.count || 0 };
    }),
  );
  return perMonth;
}

module.exports = {
  monthlyBreakdown,
  monthlyTrend,
  weeklyBuckets,
  budgetPerformance,
  categoryAverages,
  summaryWithComparisons,
  categoryTrend,
};
