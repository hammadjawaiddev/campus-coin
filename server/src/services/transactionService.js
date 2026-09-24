const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const detection = require('./detectionService');
const budgetService = require('./budgetService');
const notificationService = require('./notificationService');
const categorizationService = require('./categorizationService');
const activityService = require('./activityService');
const { startOfDayUTC, nextOccurrenceFrom } = require('../utils/date');
const { round2, percentOf } = require('../utils/number');
const { logger } = require('../utils/logger');

/**
 * Transaction orchestration layer. Controllers stay thin; all side effects
 * (anomaly detection, budget alerts, streaks, learning signals) live here.
 */

const SORTABLE = {
  date: 'date',
  amount: 'amount',
  createdAt: 'createdAt',
  category: 'category',
};

/** Builds the Mongo filter for the /transactions list endpoint. */
function buildListFilter(userId, query = {}) {
  const filter = { user: userId };
  const { type, category, categories, from, to, search, minAmount, maxAmount, source, recurring } = query;

  if (type && ['income', 'expense'].includes(type)) filter.type = type;
  if (category && mongoose.Types.ObjectId.isValid(category)) filter.category = category;
  if (categories) {
    const list = String(categories).split(',').filter((c) => mongoose.Types.ObjectId.isValid(c));
    if (list.length) filter.category = { $in: list };
  }
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDayUTC(new Date(from));
    if (to) filter.date.$lte = new Date(new Date(to).setUTCHours(23, 59, 59, 999));
  }
  if (minAmount || maxAmount) {
    filter.amount = {};
    if (minAmount) filter.amount.$gte = Number(minAmount);
    if (maxAmount) filter.amount.$lte = Number(maxAmount);
  }
  if (source && ['manual', 'csv', 'seed', 'recurring'].includes(source)) filter.source = source;
  if (recurring === 'true') filter.recurring = true;
  if (recurring === 'false') filter.recurring = false;

  if (search) {
    const safe = String(search).trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { description: { $regex: safe, $options: 'i' } },
      { notes: { $regex: safe, $options: 'i' } },
    ];
  }
  return filter;
}

async function list(userId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
  const sortField = SORTABLE[query.sortBy] || 'date';
  const sortDir = query.sortDir === 'asc' ? 1 : -1;

  const filter = buildListFilter(userId, query);

  const [items, total, totals] = await Promise.all([
    Transaction.find(filter)
      .populate('category', 'name color icon type')
      .populate('aiSuggestedCategory', 'name color icon')
      .sort({ [sortField]: sortDir, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const income = round2(totals.find((t) => t._id === 'income')?.total || 0);
  const expense = round2(totals.find((t) => t._id === 'expense')?.total || 0);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    summary: { income, expense, net: round2(income - expense), count: total },
  };
}

/** Keep a simple consecutive-day logging streak on the student's profile. */
async function touchStreak(user, date) {
  const day = startOfDayUTC(date);
  const last = user.streak?.lastLoggedDate ? startOfDayUTC(user.streak.lastLoggedDate) : null;
  if (last && last.getTime() === day.getTime()) return;

  let current = 1;
  if (last) {
    const diffDays = Math.round((day - last) / 86400000);
    if (diffDays === 1) current = (user.streak?.current || 0) + 1;
    else if (diffDays <= 0) current = user.streak?.current || 1;
    else current = 1;
  }
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        'streak.current': current,
        'streak.longest': Math.max(current, user.streak?.longest || 0),
        'streak.lastLoggedDate': day,
      },
    },
  );
}

/**
 * Create a transaction with all side effects.
 * @param {object} user  mongoose user document
 * @param {object} payload validated body
 * @param {{source?:string, importBatch?:string, skipDetection?:boolean, silent?:boolean}} options
 */
async function create(user, payload, options = {}) {
  const { source = 'manual', importBatch = null, skipDetection = false, silent = false } = options;
  const category = await Category.findOne({ _id: payload.category, user: user._id });
  if (!category) throw ApiError.badRequest('Please choose one of your own categories');

  const date = payload.date ? new Date(payload.date) : new Date();
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid transaction date');

  const doc = {
    user: user._id,
    category: category._id,
    type: payload.type || category.type,
    amount: payload.amount,
    description: payload.description || '',
    notes: payload.notes || '',
    date,
    recurring: Boolean(payload.recurring),
    recurringFrequency: payload.recurring ? payload.recurringFrequency || 'monthly' : null,
    recurringStatus: payload.recurring ? 'active' : null,
    nextOccurrence: payload.recurring ? nextOccurrenceFrom(date, payload.recurringFrequency || 'monthly') : null,
    source,
    importBatch,
    aiSuggestedCategory: payload.aiSuggestedCategory || null,
    aiConfidence: payload.aiConfidence ?? null,
    aiSource: payload.aiSource || null,
    aiSuggestionAccepted: payload.aiSuggestedCategory ? String(payload.aiSuggestedCategory) === String(category._id) : null,
    userConfirmedCategory: category._id,
  };

  // Advisory intelligence (never blocks the write).
  if (!skipDetection && doc.type === 'expense') {
    const [large, duplicate] = await Promise.all([
      detection.checkLargeTransaction({ userId: user._id, categoryId: category._id, amount: doc.amount, type: doc.type }),
      detection.checkDuplicate({ userId: user._id, amount: doc.amount, type: doc.type, date, description: doc.description }),
    ]);
    doc.isAnomaly = large.isAnomaly;
    doc.anomalyReason = [large.reason, duplicate.isDuplicate ? duplicate.reason : ''].filter(Boolean).join(' ');
    doc.anomalyScore = large.score;

    if (!silent) {
      if (duplicate.isDuplicate) {
        await notificationService.notify({
          user: user._id,
          ...notificationService.NOTIFICATION_TEMPLATES.duplicateTransaction(category.name, doc.amount, user.preferences?.currency === 'PKR' ? 'Rs' : '$'),
          dedupeKey: `dup:${user._id}:${doc.amount}:${date.toISOString().slice(0, 10)}:${category._id}`,
          meta: { matches: duplicate.matches, categoryId: category._id },
        });
      }
      if (large.isAnomaly) {
        await notificationService.notify({
          user: user._id,
          ...notificationService.NOTIFICATION_TEMPLATES.largeTransaction(category.name, doc.amount, user.preferences?.currency === 'PKR' ? 'Rs' : '$', large.multiple || 2.5),
          dedupeKey: `large:${user._id}:${doc.amount}:${date.toISOString().slice(0, 10)}:${category._id}`,
          meta: { multiple: large.multiple, reference: large.reference, categoryId: category._id },
        });
      }
    }
  }

  const transaction = await Transaction.create(doc);

  // Learning signal for the categorisation assistant.
  if (payload.aiSuggestedCategory) {
    await categorizationService.recordFeedback({
      userId: user._id,
      description: doc.description,
      suggestedCategoryId: payload.aiSuggestedCategory,
      confirmedCategoryId: category._id,
      source: payload.aiSource || 'rules',
      confidence: payload.aiConfidence ?? null,
    }).catch((e) => logger.debug('feedback failed', e.message));
  }

  if (!silent) {
    await touchStreak(user, date);
    await budgetService.evaluateAndAlert(user._id, { month: date, currency: currencySymbol(user), categoryIds: [category._id] });
    await activityService.logActivity({
      user: user._id, action: 'create', entity: 'transaction', entityId: transaction._id,
      label: `${doc.type === 'income' ? '+' : '-'}${doc.amount} ${category.name}`,
    });
  }

  return transaction.populate('category', 'name color icon type');
}

function currencySymbol(user) {
  const map = { USD: '$', PKR: 'Rs', INR: '₹', EUR: '€', GBP: '£', AED: 'AED', SAR: 'SAR', BDT: '৳' };
  return map[user?.preferences?.currency] || '$';
}

async function update(user, id, payload) {
  const transaction = await Transaction.findOne({ _id: id, user: user._id });
  if (!transaction) throw ApiError.notFound('Transaction not found');

  if (payload.category) {
    const category = await Category.findOne({ _id: payload.category, user: user._id });
    if (!category) throw ApiError.badRequest('Please choose one of your own categories');
    transaction.category = category._id;
    transaction.userConfirmedCategory = category._id;
    if (transaction.aiSuggestedCategory) {
      transaction.aiSuggestionAccepted = String(transaction.aiSuggestedCategory) === String(category._id);
      await categorizationService.recordFeedback({
        userId: user._id,
        description: payload.description ?? transaction.description,
        suggestedCategoryId: transaction.aiSuggestedCategory,
        confirmedCategoryId: category._id,
        source: transaction.aiSource || 'rules',
        confidence: transaction.aiConfidence,
      }).catch(() => {});
    }
  }

  const previousDate = transaction.date;
  ['amount', 'description', 'notes', 'type'].forEach((field) => {
    if (payload[field] !== undefined) transaction[field] = payload[field];
  });
  if (payload.date) transaction.date = new Date(payload.date);

  if (payload.recurring !== undefined) {
    transaction.recurring = Boolean(payload.recurring);
    transaction.recurringStatus = payload.recurring ? 'active' : null;
    transaction.recurringFrequency = payload.recurring ? payload.recurringFrequency || transaction.recurringFrequency || 'monthly' : null;
    transaction.nextOccurrence = payload.recurring ? nextOccurrenceFrom(transaction.date, transaction.recurringFrequency) : null;
  } else if (payload.recurringFrequency && transaction.recurring) {
    transaction.recurringFrequency = payload.recurringFrequency;
    transaction.nextOccurrence = nextOccurrenceFrom(transaction.date, payload.recurringFrequency);
  }

  // Re-run detection on meaningful edits.
  if (transaction.type === 'expense' && (payload.amount !== undefined || payload.category !== undefined)) {
    const large = await detection.checkLargeTransaction({
      userId: user._id, categoryId: transaction.category, amount: transaction.amount, type: transaction.type, excludeId: transaction._id,
    });
    transaction.isAnomaly = large.isAnomaly;
    transaction.anomalyReason = large.reason;
    transaction.anomalyScore = large.score;
  }

  await transaction.save();

  await budgetService.evaluateAndAlert(user._id, { month: transaction.date, currency: currencySymbol(user), categoryIds: [transaction.category] });
  if (previousDate.getUTCMonth() !== transaction.date.getUTCMonth()) {
    await budgetService.evaluateAndAlert(user._id, { month: previousDate, currency: currencySymbol(user), categoryIds: [transaction.category] });
  }
  await activityService.logActivity({
    user: user._id, action: 'update', entity: 'transaction', entityId: transaction._id, label: transaction.description || 'Transaction updated',
  });

  return transaction.populate('category', 'name color icon type');
}

async function remove(user, id) {
  const transaction = await Transaction.findOne({ _id: id, user: user._id });
  if (!transaction) throw ApiError.notFound('Transaction not found');

  await transaction.deleteOne();
  // Descendants of a recurring template stay, but are detached.
  await Transaction.updateMany({ parentTransaction: transaction._id }, { $set: { parentTransaction: null, isGenerated: true } });

  await budgetService.evaluateAndAlert(user._id, { month: transaction.date, currency: currencySymbol(user), categoryIds: [transaction.category] });
  await activityService.logActivity({
    user: user._id, action: 'delete', entity: 'transaction', entityId: transaction._id, label: transaction.description || 'Transaction deleted',
  });
  return transaction;
}

async function getOne(user, id) {
  const transaction = await Transaction.findOne({ _id: id, user: user._id })
    .populate('category', 'name color icon type')
    .populate('aiSuggestedCategory', 'name color icon')
    .lean();
  if (!transaction) throw ApiError.notFound('Transaction not found');
  await activityService.logActivity({ user: user._id, action: 'view', entity: 'transaction', entityId: id, label: 'Viewed transaction' });
  return transaction;
}

/** Duplicate check exposed to the add/edit form before saving. */
async function precheck(user, { amount, type, date, description, categoryId, excludeId = null }) {
  const [duplicate, large] = await Promise.all([
    detection.checkDuplicate({ userId: user._id, amount: Number(amount), type, date: date || new Date(), description: description || '', excludeId }),
    categoryId && type === 'expense'
      ? detection.checkLargeTransaction({ userId: user._id, categoryId, amount: Number(amount), type, excludeId })
      : Promise.resolve({ isAnomaly: false }),
  ]);
  const consumption = categoryId && type === 'expense'
    ? await budgetService.consumptionForCategory(user._id, categoryId, date || new Date())
    : null;

  // Project what the pending amount would do to that category's cap so the
  // client can warn before the entry is saved, not after.
  let budget = null;
  if (consumption) {
    const category = await Category.findOne({ _id: categoryId, user: user._id }).select('name').lean();
    const projectedSpent = round2(consumption.spent + Number(amount));
    const projectedPercent = percentOf(projectedSpent, consumption.limit);
    const alertThreshold = consumption.alertThreshold ?? 80;
    budget = {
      ...consumption,
      categoryName: category?.name || 'This category',
      pendingAmount: round2(Number(amount)),
      projectedSpent,
      projectedPercent,
      projectedStatus: projectedSpent >= consumption.limit ? 'over' : projectedPercent >= alertThreshold ? 'near' : 'safe',
    };
  }

  return { duplicate, large, budget };
}

module.exports = { list, create, update, remove, getOne, precheck, buildListFilter, currencySymbol, touchStreak };
