const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const activityService = require('../services/activityService');
const { CATEGORY_ICON_CHOICES, CATEGORY_COLOR_CHOICES, DEFAULT_CATEGORIES } = require('../config/constants');

const serialise = (category, usage = {}) => ({
  id: category._id,
  name: category.name,
  type: category.type,
  icon: category.icon,
  color: category.color,
  isDefault: category.isDefault,
  isArchived: category.isArchived,
  keywords: category.keywords,
  monthlyBudgetHint: category.monthlyBudgetHint,
  order: category.order,
  transactionCount: usage.count || 0,
  totalAmount: usage.total || 0,
  createdAt: category.createdAt,
});

/** GET /api/categories */
const list = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const query = { user: req.user._id };
  if (type) query.type = type;
  if (req.query.includeArchived !== 'true') query.isArchived = false;

  const [categories, usage] = await Promise.all([
    Category.find(query).sort({ type: 1, order: 1, name: 1 }).lean(),
    Transaction.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const usageMap = new Map(usage.map((u) => [String(u._id), u]));
  const items = categories.map((c) => serialise(c, usageMap.get(String(c._id))));

  return ok(
    res,
    {
      categories: items,
      income: items.filter((c) => c.type === 'income'),
      expense: items.filter((c) => c.type === 'expense'),
      options: { icons: CATEGORY_ICON_CHOICES, colors: CATEGORY_COLOR_CHOICES, defaults: DEFAULT_CATEGORIES.map((d) => ({ name: d.name, type: d.type, icon: d.icon, color: d.color })) },
    },
    'Categories loaded',
  );
});

/** POST /api/categories */
const create = asyncHandler(async (req, res) => {
  const { name, type, icon, color, keywords, monthlyBudgetHint } = req.body;
  const trimmed = String(name).trim();

  const duplicate = await Category.findOne({ user: req.user._id, name: new RegExp(`^${trimmed}$`, 'i'), type });
  if (duplicate) throw ApiError.conflict(`You already have a ${type} category named "${trimmed}"`);

  const count = await Category.countDocuments({ user: req.user._id, type });
  const category = await Category.create({
    user: req.user._id,
    name: trimmed,
    type,
    icon: icon || (type === 'income' ? 'Coins' : 'Package'),
    color: color || '#6D5DFB',
    keywords: Array.isArray(keywords) ? keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 12) : [],
    monthlyBudgetHint: Number(monthlyBudgetHint) || 0,
    order: count,
    isDefault: false,
  });

  await activityService.logActivity({ user: req.user._id, action: 'create', entity: 'category', entityId: category._id, label: category.name });
  return created(res, { category: serialise(category) }, 'Category created');
});

/** PUT /api/categories/:id */
const update = asyncHandler(async (req, res) => {
  const category = req.owned;
  const { name, icon, color, keywords, monthlyBudgetHint, isArchived } = req.body;

  if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
    const duplicate = await Category.findOne({
      user: req.user._id, type: category.type, _id: { $ne: category._id },
      name: new RegExp(`^${String(name).trim()}$`, 'i'),
    });
    if (duplicate) throw ApiError.conflict(`You already have a category named "${name.trim()}"`);
    category.name = String(name).trim();
  }

  if (icon) category.icon = icon;
  if (color) category.color = color;
  if (monthlyBudgetHint !== undefined) category.monthlyBudgetHint = Math.max(0, Number(monthlyBudgetHint) || 0);
  if (Array.isArray(keywords)) category.keywords = keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 12);
  if (isArchived !== undefined) category.isArchived = Boolean(isArchived);

  await category.save();
  await activityService.logActivity({ user: req.user._id, action: 'update', entity: 'category', entityId: category._id, label: category.name });
  return ok(res, { category: serialise(category) }, 'Category updated');
});

/** GET /api/categories/:id/usage — what would break if this category is deleted. */
const usage = asyncHandler(async (req, res) => {
  const category = req.owned;
  const [count, total, budgets, latest] = await Promise.all([
    Transaction.countDocuments({ user: req.user._id, category: category._id }),
    Transaction.aggregate([{ $match: { user: req.user._id, category: category._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Budget.countDocuments({ user: req.user._id, category: category._id }),
    Transaction.find({ user: req.user._id, category: category._id }).sort({ date: -1 }).limit(5).select('amount date description type').lean(),
  ]);
  return ok(res, { categoryId: category._id, transactionCount: count, totalAmount: total[0]?.total || 0, budgetCount: budgets, recent: latest }, 'Category usage');
});

/**
 * DELETE /api/categories/:id
 * Refuses while transactions exist unless the caller supplies
 * `?reassignTo=<categoryId>` (or `?force=true` moves them to Miscellaneous).
 */
const remove = asyncHandler(async (req, res) => {
  const category = req.owned;
  const { reassignTo, force } = req.query;

  const transactionCount = await Transaction.countDocuments({ user: req.user._id, category: category._id });

  if (transactionCount > 0) {
    let targetId = reassignTo;
    if (!targetId && force === 'true') {
      const fallbackName = category.type === 'income' ? 'Other Income' : 'Miscellaneous';
      const fallback = await Category.findOne({ user: req.user._id, name: fallbackName, type: category.type });
      targetId = fallback?._id;
    }
    if (!targetId) {
      throw ApiError.conflict(
        `This category is used by ${transactionCount} transaction${transactionCount === 1 ? '' : 's'}. Reassign them to another category before deleting.`,
        { transactionCount, requiresReassign: true },
      );
    }

    const target = await Category.findOne({ _id: targetId, user: req.user._id, type: category.type });
    if (!target) throw ApiError.badRequest('Choose one of your own categories with the same type to reassign to');
    if (String(target._id) === String(category._id)) throw ApiError.badRequest('Pick a different category to move transactions into');

    await Transaction.updateMany(
      { user: req.user._id, category: category._id },
      { $set: { category: target._id, userConfirmedCategory: target._id } },
    );
    await Budget.updateMany({ user: req.user._id, category: category._id }, { $set: { category: target._id } });
    await Transaction.updateMany({ user: req.user._id, aiSuggestedCategory: category._id }, { $set: { aiSuggestedCategory: target._id } });
  }

  await Budget.deleteMany({ user: req.user._id, category: category._id });
  await category.deleteOne();

  await activityService.logActivity({ user: req.user._id, action: 'delete', entity: 'category', label: category.name });
  return ok(res, { id: category._id, reassigned: transactionCount }, 'Category deleted');
});

/** POST /api/categories/restore-defaults — re-add any missing SRS default categories. */
const restoreDefaults = asyncHandler(async (req, res) => {
  const existing = await Category.find({ user: req.user._id }).select('name type').lean();
  const have = new Set(existing.map((c) => `${c.type}:${c.name.toLowerCase()}`));
  const missing = DEFAULT_CATEGORIES.filter((d) => !have.has(`${d.type}:${d.name.toLowerCase()}`));

  if (!missing.length) return ok(res, { created: 0 }, 'All default categories already exist');

  const docs = await Category.insertMany(
    missing.map((d, i) => ({
      user: req.user._id, name: d.name, type: d.type, icon: d.icon, color: d.color,
      keywords: d.keywords, isDefault: true, order: existing.length + i,
    })),
  );
  return created(res, { created: docs.length, categories: docs.map((d) => serialise(d)) }, `${docs.length} default categories restored`);
});

module.exports = { list, create, update, remove, usage, restoreDefaults, serialise };
