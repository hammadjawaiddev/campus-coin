const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const analytics = require('./analyticsService');
const notificationService = require('./notificationService');
const { startOfMonthUTC, endOfMonthUTC, monthKey, shortMonthLabel } = require('../utils/date');
const { round2, percentOf } = require('../utils/number');

/**
 * Budget evaluation + alerting.
 *
 * `evaluateAndAlert` is called after every transaction write for the affected
 * month, and again lazily when the dashboard is opened. Alerts are de-duplicated
 * per budget + month + level, so a student sees "Food at 85%" once, not on every
 * page load.
 */
async function evaluateAndAlert(userId, { month = new Date(), currency = '$', categoryIds = null } = {}) {
  const monthStart = startOfMonthUTC(month);
  const performance = await analytics.budgetPerformance(userId, monthStart, currency);
  const created = [];

  const relevant = categoryIds
    ? performance.rows.filter((row) => categoryIds.map(String).includes(String(row.categoryId)))
    : performance.rows;

  for (const row of relevant) {
    const budget = await Budget.findOne({ user: userId, month: monthStart, category: row.categoryId });
    if (!budget) continue;

    if (row.status === 'over' && budget.notifyExceeded) {
      const notification = await notificationService.notify({
        user: userId,
        ...notificationService.NOTIFICATION_TEMPLATES.budgetExceeded(row.categoryName, Math.abs(row.remaining), currency),
        dedupeKey: `budget-over:${budget._id}:${monthKey(monthStart)}`,
        meta: { budgetId: budget._id, categoryId: row.categoryId, spent: row.spent, limit: row.limit },
      });
      if (notification) {
        created.push(notification);
        budget.alerts.exceeded = new Date();
        await budget.save();
      }
    } else if (row.status === 'near' && budget.notifyNearLimit) {
      const notification = await notificationService.notify({
        user: userId,
        ...notificationService.NOTIFICATION_TEMPLATES.budgetNear(row.categoryName, Math.round(row.percentUsed), Math.max(0, row.remaining), currency),
        dedupeKey: `budget-near:${budget._id}:${monthKey(monthStart)}`,
        meta: { budgetId: budget._id, categoryId: row.categoryId, spent: row.spent, limit: row.limit, percent: row.percentUsed },
      });
      if (notification) {
        created.push(notification);
        budget.alerts.near = new Date();
        await budget.save();
      }
    }
  }

  return { performance, alerts: created };
}

/** Live budget consumption for one category (used by the quick-add form). */
async function consumptionForCategory(userId, categoryId, month = new Date()) {
  const monthStart = startOfMonthUTC(month);
  const budget = await Budget.findOne({ user: userId, month: monthStart, category: categoryId }).lean();
  if (!budget) return null;

  const rows = await Transaction.aggregate([
    { $match: { user: userId, category: categoryId, type: 'expense', date: { $gte: monthStart, $lte: endOfMonthUTC(monthStart) } } },
    { $group: { _id: null, spent: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const spent = round2(rows[0]?.spent || 0);
  const percentUsed = percentOf(spent, budget.limitAmount);
  const alertThreshold = budget.alertThreshold ?? 80;
  return {
    budgetId: budget._id,
    limit: round2(budget.limitAmount),
    spent,
    remaining: round2(budget.limitAmount - spent),
    percentUsed,
    alertThreshold,
    status: spent >= budget.limitAmount ? 'over' : percentUsed >= alertThreshold ? 'near' : 'safe',
  };
}

/**
 * Copy the previous month's budgets into `month` for any category that does not
 * already have one — used by the "copy last month" action and on month rollover.
 */
async function carryOverBudgets(userId, month = new Date(), { sourceMonth = null } = {}) {
  const target = startOfMonthUTC(month);
  const source = sourceMonth ? startOfMonthUTC(sourceMonth) : new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() - 1, 1));

  const [existing, previous] = await Promise.all([
    Budget.find({ user: userId, month: target }).select('category').lean(),
    Budget.find({ user: userId, month: source }).lean(),
  ]);
  const have = new Set(existing.map((b) => String(b.category)));

  const toCreate = previous
    .filter((b) => !have.has(String(b.category)))
    .map((b) => ({
      user: userId,
      category: b.category,
      type: b.type,
      month: target,
      limitAmount: b.limitAmount,
      alertThreshold: b.alertThreshold,
      notifyNearLimit: b.notifyNearLimit,
      notifyExceeded: b.notifyExceeded,
      note: b.note,
    }));

  if (!toCreate.length) return { created: 0, budgets: [] };
  const budgets = await Budget.insertMany(toCreate);
  return { created: budgets.length, budgets };
}

/** Budgets the student should consider creating, based on their top spend. */
async function suggestedBudgets(userId, month = new Date()) {
  const monthStart = startOfMonthUTC(month);
  const [performance, averages] = await Promise.all([
    analytics.budgetPerformance(userId, monthStart),
    analytics.categoryAverages(userId, 3, monthStart),
  ]);
  const budgeted = new Set(performance.rows.map((r) => String(r.categoryId)));

  return averages
    .filter((a) => !budgeted.has(String(a.categoryId)) && a.monthlyAverage >= 5)
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)
    .slice(0, 4)
    .map((a) => ({
      categoryId: a.categoryId,
      name: a.name,
      color: a.color,
      icon: a.icon,
      suggestedLimit: Math.max(5, Math.round(a.monthlyAverage * 0.9)),
      averageSpend: a.monthlyAverage,
      reason: `You average ${a.monthlyAverage.toFixed(2)}/month on ${a.name} with no cap set.`,
      month: monthStart,
      monthLabel: shortMonthLabel(monthStart),
    }));
}

/** Validate that a category belongs to the student and is an expense/income kind. */
async function assertCategoryOwnership(userId, categoryId, expectedType = null) {
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) return null;
  if (expectedType && category.type !== expectedType) return null;
  return category;
}

module.exports = { evaluateAndAlert, consumptionForCategory, carryOverBudgets, suggestedBudgets, assertCategoryOwnership };
