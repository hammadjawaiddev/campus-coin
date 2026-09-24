const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const analytics = require('../services/analyticsService');
const budgetService = require('../services/budgetService');
const notificationService = require('../services/notificationService');
const activityService = require('../services/activityService');
const { currencySymbol } = require('../services/transactionService');
const { ok, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { startOfMonthUTC, addMonthsUTC, monthKey, shortMonthLabel } = require('../utils/date');

/** GET /api/budgets?month=YYYY-MM */
const list = asyncHandler(async (req, res) => {
  const month = Budget.parseMonthParam(req.query.month);
  const currency = currencySymbol(req.user);

  const [performance, suggestions, history] = await Promise.all([
    analytics.budgetPerformance(req.user._id, month, currency),
    budgetService.suggestedBudgets(req.user._id, month),
    analytics.monthlyTrend(req.user._id, 6, month),
  ]);

  return ok(
    res,
    {
      month,
      monthKey: monthKey(month),
      monthLabel: shortMonthLabel(month),
      currency,
      budgets: performance.rows,
      summary: performance.summary,
      suggestions,
      history: history.map((h) => ({ key: h.key, label: h.label, expense: h.expense, income: h.income, net: h.net })),
      alerts: performance.rows.filter((r) => r.status !== 'safe').map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        status: r.status,
        percentUsed: r.percentUsed,
        remaining: r.remaining,
        message:
          r.status === 'over'
            ? `${r.categoryName} is over budget by ${currency}${Math.abs(r.remaining).toFixed(2)} (${Math.round(r.percentUsed)}% used).`
            : `${r.categoryName} is at ${Math.round(r.percentUsed)}% — ${currency}${Math.max(0, r.remaining).toFixed(2)} left.`,
      })),
    },
    'Budgets loaded',
  );
});

/** POST /api/budgets — create or update the budget for category + month. */
const upsert = asyncHandler(async (req, res) => {
  const { categoryId, limitAmount, month: monthParam, alertThreshold, notifyNearLimit, notifyExceeded, note } = req.body;
  const month = Budget.parseMonthParam(monthParam);

  const category = await Category.findOne({ _id: categoryId, user: req.user._id });
  if (!category) throw ApiError.badRequest('Choose one of your own categories');

  const budget = await Budget.findOneAndUpdate(
    { user: req.user._id, month, category: category._id },
    {
      $set: {
        limitAmount: Number(limitAmount),
        type: category.type,
        alertThreshold: alertThreshold ?? 80,
        notifyNearLimit: notifyNearLimit ?? true,
        notifyExceeded: notifyExceeded ?? true,
        note: note || '',
      },
      $setOnInsert: { user: req.user._id, month, category: category._id },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).populate('category', 'name color icon type');

  await activityService.logActivity({
    user: req.user._id, action: 'update', entity: 'budget', entityId: budget._id,
    label: `${category.name} cap ${limitAmount}`,
  });

  // Immediately re-check thresholds so a lowered cap can alert right away.
  const { performance } = await budgetService.evaluateAndAlert(req.user._id, {
    month, currency: currencySymbol(req.user), categoryIds: [category._id],
  });

  const row = performance.rows.find((r) => String(r.categoryId) === String(category._id));
  return created(res, { budget: row || budget, alerts: performance.rows.filter((r) => r.status !== 'safe') }, 'Budget saved');
});

/** PUT /api/budgets/:id */
const update = asyncHandler(async (req, res) => {
  const budget = req.owned;
  const { limitAmount, alertThreshold, notifyNearLimit, notifyExceeded, note, month: monthParam } = req.body;

  if (limitAmount !== undefined) budget.limitAmount = Number(limitAmount);
  if (alertThreshold !== undefined) budget.alertThreshold = Math.min(150, Math.max(10, Number(alertThreshold)));
  if (notifyNearLimit !== undefined) budget.notifyNearLimit = Boolean(notifyNearLimit);
  if (notifyExceeded !== undefined) budget.notifyExceeded = Boolean(notifyExceeded);
  if (note !== undefined) budget.note = note;
  if (monthParam) budget.month = Budget.parseMonthParam(monthParam);

  // Threshold edits should be able to fire a fresh alert for the new level.
  if (alertThreshold !== undefined || limitAmount !== undefined) {
    budget.alerts.near = null;
    budget.alerts.exceeded = null;
  }

  await budget.save();
  await budgetService.evaluateAndAlert(req.user._id, { month: budget.month, currency: currencySymbol(req.user), categoryIds: [budget.category] });

  const performance = await analytics.budgetPerformance(req.user._id, budget.month, currencySymbol(req.user));
  const row = performance.rows.find((r) => String(r.categoryId) === String(budget.category));
  return ok(res, { budget: row }, 'Budget updated');
});

/** DELETE /api/budgets/:id */
const remove = asyncHandler(async (req, res) => {
  await req.owned.deleteOne();
  await activityService.logActivity({ user: req.user._id, action: 'delete', entity: 'budget', entityId: req.params.id, label: 'Budget removed' });
  return ok(res, { id: req.params.id }, 'Budget removed');
});

/** POST /api/budgets/copy — copy last month's caps into this month. */
const copyPrevious = asyncHandler(async (req, res) => {
  const month = Budget.parseMonthParam(req.body.month);
  const result = await budgetService.carryOverBudgets(req.user._id, month, { sourceMonth: req.body.sourceMonth });
  if (!result.created) return ok(res, { created: 0 }, `No budgets to copy — ${shortMonthLabel(addMonthsUTC(month, -1))} had none outstanding`);
  return created(res, { created: result.created }, `${result.created} budget${result.created === 1 ? '' : 's'} copied from last month`);
});

/** GET /api/budgets/alerts — the alert feed shown on the dashboard. */
const alerts = asyncHandler(async (req, res) => {
  const month = Budget.parseMonthParam(req.query.month);
  const { performance } = await budgetService.evaluateAndAlert(req.user._id, { month, currency: currencySymbol(req.user) });
  return ok(
    res,
    {
      alerts: performance.rows
        .filter((r) => r.status !== 'safe')
        .map((r) => ({ ...r, message: `${r.categoryName}: ${Math.round(r.percentUsed)}% used` })),
      summary: performance.summary,
    },
    'Budget alerts',
  );
});

/** POST /api/budgets/reset-alerts — silence current alerts for this month. */
const resetAlerts = asyncHandler(async (req, res) => {
  const month = Budget.parseMonthParam(req.body.month);
  await Budget.updateMany({ user: req.user._id, month }, { $set: { 'alerts.near': null, 'alerts.exceeded': null } });
  await notificationService.markAllRead(req.user._id);
  return ok(res, null, 'Budget alerts reset for this month');
});

/** GET /api/budgets/insights — how the student's caps compare with real spend. */
const insights = asyncHandler(async (req, res) => {
  const month = Budget.parseMonthParam(req.query.month);
  const currency = currencySymbol(req.user);
  const [performance, averages] = await Promise.all([
    analytics.budgetPerformance(req.user._id, month, currency),
    analytics.categoryAverages(req.user._id, 3, month),
  ]);

  const avgByName = new Map(averages.map((a) => [a.name, a.monthlyAverage]));
  const rows = performance.rows.map((row) => {
    const avg = avgByName.get(row.categoryName) || 0;
    return {
      categoryName: row.categoryName,
      limit: row.limit,
      averageSpend: avg,
      verdict: avg && row.limit < avg * 0.8 ? 'too_tight' : avg && row.limit > avg * 1.4 ? 'too_loose' : 'realistic',
      suggestion:
        avg && row.limit < avg * 0.8
          ? `Your cap of ${currency}${row.limit} is well below your ${currency}${avg.toFixed(2)} average — you are likely to break it. Consider ${currency}${Math.round(avg * 0.95)}.`
          : avg && row.limit > avg * 1.4
            ? `Your cap is ${Math.round(((row.limit - avg) / avg) * 100)}% above your average spend, so it will never warn you. Try ${currency}${Math.round(avg * 1.1)}.`
            : 'This cap matches your recent spending pattern.',
    };
  });

  return ok(res, { rows, unbudgetedSpend: performance.summary.unbudgetedSpend }, 'Budget insights');
});

/** GET /api/budgets/usage/:categoryId — live consumption for the quick-add form. */
const categoryUsage = asyncHandler(async (req, res) => {
  const month = Budget.parseMonthParam(req.query.month);
  const consumption = await budgetService.consumptionForCategory(req.user._id, req.params.categoryId, month);
  const spent = await Transaction.aggregate([
    { $match: { user: req.user._id, category: require('mongoose').Types.ObjectId.createFromHexString(String(req.params.categoryId)), type: 'expense', date: { $gte: startOfMonthUTC(month) } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return ok(
    res,
    {
      budget: consumption,
      spentThisMonth: spent[0]?.total || 0,
      transactionCount: spent[0]?.count || 0,
      currency: currencySymbol(req.user),
    },
    'Category usage',
  );
});

module.exports = { list, upsert, update, remove, copyPrevious, alerts, resetAlerts, insights, categoryUsage };
