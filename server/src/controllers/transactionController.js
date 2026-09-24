const Transaction = require('../models/Transaction');
const categoryService = require('../services/categorizationService');
const transactionService = require('../services/transactionService');
const recurringService = require('../services/recurringService');
const activityService = require('../services/activityService');
const detection = require('../services/detectionService');
const { ok, created, paginated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * GET /api/transactions
 * `data` carries the rows plus a summary of the *filtered* set, `meta` carries
 * pagination so the client can render both a list and a pager.
 */
const list = asyncHandler(async (req, res) => {
  const { items, pagination, summary } = await transactionService.list(req.user._id, req.query);
  return ok(
    res,
    { transactions: items, summary },
    `Transactions loaded (${summary.count} matching)`,
    pagination,
  );
});

/** GET /api/transactions/meta — filter + sort options for the toolbar. */
const meta = asyncHandler(async (req, res) => {
  const Category = require('../models/Category');
  const categories = await Category.find({ user: req.user._id, isArchived: false }).sort({ type: 1, order: 1 }).lean();
  return ok(
    res,
    {
      categories: categories.map((c) => ({ id: c._id, name: c.name, type: c.type, color: c.color, icon: c.icon })),
      sources: ['manual', 'csv', 'seed', 'recurring'],
      sortOptions: [
        { value: 'date:desc', label: 'Newest first' },
        { value: 'date:asc', label: 'Oldest first' },
        { value: 'amount:desc', label: 'Highest amount' },
        { value: 'amount:asc', label: 'Lowest amount' },
        { value: 'createdAt:desc', label: 'Recently added' },
      ],
      currency: transactionService.currencySymbol(req.user),
      isAnomalyCount: await Transaction.countDocuments({ user: req.user._id, isAnomaly: true }),
    },
    'Transaction metadata',
  );
});

/** GET /api/transactions/:id */
const getOne = asyncHandler(async (req, res) => {
  const transaction = await transactionService.getOne(req.user, req.params.id);
  return ok(res, { transaction }, 'Transaction loaded');
});

/** POST /api/transactions */
const create = asyncHandler(async (req, res) => {
  const transaction = await transactionService.create(req.user, req.body, {
    source: req.body.source === 'csv' ? 'csv' : 'manual',
  });
  const warnings = [];
  if (transaction.isAnomaly) warnings.push(transaction.anomalyReason);
  return created(res, { transaction, warnings }, 'Transaction added');
});

/** PUT /api/transactions/:id */
const update = asyncHandler(async (req, res) => {
  const transaction = await transactionService.update(req.user, req.params.id, req.body);
  return ok(res, { transaction }, 'Transaction updated');
});

/** DELETE /api/transactions/:id */
const remove = asyncHandler(async (req, res) => {
  await transactionService.remove(req.user, req.params.id);
  return ok(res, { id: req.params.id }, 'Transaction deleted');
});

/** POST /api/transactions/:id/duplicate — quick repeat-entry helper. */
const duplicate = asyncHandler(async (req, res) => {
  const original = await Transaction.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!original) throw ApiError.notFound('Transaction not found');

  const transaction = await transactionService.create(
    req.user,
    {
      category: original.category,
      type: original.type,
      amount: original.amount,
      description: original.description,
      notes: original.notes,
      date: req.body.date || new Date(),
      recurring: false,
    },
    { silent: true },
  );
  return created(res, { transaction }, 'Transaction duplicated');
});

/** POST /api/transactions/ai-suggest — advisory category suggestion. */
const aiSuggest = asyncHandler(async (req, res) => {
  const { description, type = 'expense', amount = 0, allowAi = true } = req.body;
  const result = await categoryService.suggest({
    userId: req.user._id,
    description,
    type,
    amount: Number(amount) || 0,
    currency: transactionService.currencySymbol(req.user),
    allowAi: allowAi !== false,
  });
  return ok(res, result, result.suggested ? 'Suggestion ready' : 'No suggestion available yet');
});

/** POST /api/transactions/precheck — duplicate + anomaly + budget preview. */
const precheck = asyncHandler(async (req, res) => {
  const { amount, type = 'expense', date, description, categoryId, excludeId } = req.body;
  if (!amount) throw ApiError.badRequest('Amount is required for a pre-check');
  const result = await transactionService.precheck(req.user, { amount, type, date, description, categoryId, excludeId });
  return ok(res, result, 'Pre-check complete');
});

/** GET /api/transactions/activity/recent — recently viewed & edited (SRS optional). */
const recentActivity = asyncHandler(async (req, res) => {
  const [viewed, edited, log] = await Promise.all([
    activityService.recentlyViewedTransactions(req.user._id, 5),
    activityService.recentlyEditedTransactions(req.user._id, 5),
    activityService.recentActivity(req.user._id, { limit: 12 }),
  ]);
  return ok(
    res,
    {
      recentlyViewed: viewed.filter((v) => v.entityId).map((v) => ({ ...v.entityId, viewedAt: v.createdAt })),
      recentlyEdited: edited.filter((v) => v.entityId).map((v) => ({ ...v.entityId, editedAt: v.createdAt })),
      log: log.map((l) => ({ id: l._id, action: l.action, entity: l.entity, label: l.label, at: l.createdAt })),
    },
    'Recent activity',
  );
});

/** GET /api/transactions/recurring — recurring templates. */
const listRecurring = asyncHandler(async (req, res) => {
  const templates = await recurringService.listTemplates(req.user._id);
  return ok(res, { templates }, 'Recurring transactions');
});

/** POST /api/transactions/recurring/:id/status */
const setRecurringStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused', 'ended'].includes(status)) throw ApiError.badRequest('Invalid recurring status');
  const template = await recurringService.setStatus(req.user._id, req.params.id, status);
  if (!template) throw ApiError.notFound('Recurring transaction not found');
  return ok(res, { template }, `Recurring entry ${status}`);
});

/** POST /api/transactions/recurring/run — materialise due entries on demand. */
const runRecurring = asyncHandler(async (req, res) => {
  const result = await recurringService.runForUser(req.user._id);
  return ok(res, result, result.created ? `${result.created} recurring transactions added` : 'Everything is already up to date');
});

/** GET /api/transactions/detection/insights — large / duplicate / acceleration signals. */
const detectionInsights = asyncHandler(async (req, res) => {
  const [large, duplicates, increases, forecast] = await Promise.all([
    Transaction.find({ user: req.user._id, isAnomaly: true })
      .populate('category', 'name color icon')
      .sort({ date: -1 })
      .limit(8)
      .lean(),
    detection.checkSpendingIncrease(req.user._id, { threshold: 40 }),
    detection.checkSpendingIncrease(req.user._id, { threshold: 25 }),
    detection.forecastNextMonth(req.user._id),
  ]);

  // Group exact amount+date+type duplicates inside the last 60 days.
  const since = new Date(Date.now() - 60 * 86400000);
  const recent = await Transaction.find({ user: req.user._id, date: { $gte: since } })
    .populate('category', 'name color icon')
    .select('amount date type description category')
    .lean();
  const groups = new Map();
  recent.forEach((t) => {
    const key = `${t.date.toISOString().slice(0, 10)}|${t.amount}|${t.type}`;
    groups.set(key, [...(groups.get(key) || []), t]);
  });
  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);

  return ok(
    res,
    {
      anomalies: large.map((t) => ({
        id: t._id, amount: t.amount, description: t.description, date: t.date,
        categoryName: t.category?.name, reason: t.anomalyReason, score: t.anomalyScore,
      })),
      duplicateGroups: duplicateGroups.map((g) => ({ key: `${g[0].amount} on ${g[0].date.toISOString().slice(0, 10)}`, items: g })),
      acceleratingCategories: increases,
      trackedCategories: duplicates.length,
      forecast,
      aiCategorization: await categoryService.accuracyStats({ since }),
    },
    'Detection report',
  );
});

module.exports = {
  list, meta, getOne, create, update, remove, duplicate, aiSuggest, precheck,
  recentActivity, listRecurring, setRecurringStatus, runRecurring, detectionInsights,
};
