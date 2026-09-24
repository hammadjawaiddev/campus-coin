const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Insight = require('../models/Insight');
const SavingTip = require('../models/SavingTip');
const Announcement = require('../models/Announcement');
const ActivityLog = require('../models/ActivityLog');
const CategorizationFeedback = require('../models/CategorizationFeedback');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paginated } = require('../utils/response');
const notificationService = require('../services/notificationService');
const categorizationService = require('../services/categorizationService');
const analytics = require('../services/analyticsService');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');
const { CATEGORY_ICON_CHOICES, CATEGORY_COLOR_CHOICES, DEFAULT_CATEGORIES } = require('../config/constants');
const { lastMonths, monthKey, shortMonthLabel, startOfMonthUTC } = require('../utils/date');
const { round2 } = require('../utils/number');

/* ────────────────────────────── Dashboard ────────────────────────────── */

/** GET /api/admin/dashboard */
const dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const monthStart = startOfMonthUTC(now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [
    totalUsers, activeUsers, newUsers7, newUsers30, disabledUsers,
    totalTransactions, txThisMonth, incomeAgg, expenseAgg,
    topCategories, growth, volumeByMonth, engagement,
  ] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', isActive: true, lastLoginAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ role: 'student', createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ role: 'student', createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ isActive: false }),
    Transaction.countDocuments(),
    Transaction.countDocuments({ date: { $gte: monthStart } }),
    Transaction.aggregate([{ $match: { type: 'income' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: { type: 'expense' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.aggregate([
      { $match: { type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ['$category.name', 'Unknown'] }, color: { $ifNull: ['$category.color', '#94A3B8'] }, total: { $round: ['$total', 2] }, count: 1 } },
    ]),
    User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, users: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1 } },
      { $limit: 24 },
    ]),
    User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: null,
          avgTransactionsPerUser: { $avg: '$loginCount' },
          totalLogins: { $sum: '$loginCount' },
        },
      },
    ]),
  ]);

  const income = round2(incomeAgg[0]?.total || 0);
  const expense = round2(expenseAgg[0]?.total || 0);
  const months = lastMonths(6);
  const volumeMap = new Map(volumeByMonth.map((v) => [`${v._id.month}:${v._id.type}`, v]));

  const [insightCount, tipCount, feedback, recentUsers] = await Promise.all([
    Insight.countDocuments(),
    SavingTip.countDocuments({ dismissed: false }),
    categorizationService.accuracyStats(),
    User.find({ role: 'student' }).sort({ createdAt: -1 }).limit(5).select('name email createdAt lastLoginAt isActive academicYear').lean(),
  ]);

  return ok(
    res,
    {
      totals: {
        users: totalUsers,
        activeUsers,
        disabledUsers,
        newUsers7,
        newUsers30,
        transactions: totalTransactions,
        transactionsThisMonth: txThisMonth,
        income,
        expense,
        net: round2(income - expense),
        insights: insightCount,
        activeTips: tipCount,
      },
      mostUsedCategories: topCategories,
      userGrowth: growth.map((g) => ({ month: g._id, label: shortMonthLabel(new Date(`${g._id}-01T00:00:00.000Z`)), users: g.users })),
      transactionVolume: months.map((m) => {
        const key = monthKey(m);
        return {
          key,
          label: shortMonthLabel(m),
          income: round2(volumeMap.get(`${key}:income`)?.total || 0),
          expense: round2(volumeMap.get(`${key}:expense`)?.total || 0),
          count: (volumeMap.get(`${key}:income`)?.count || 0) + (volumeMap.get(`${key}:expense`)?.count || 0),
        };
      }),
      engagement: {
        totalLogins: engagement[0]?.totalLogins || 0,
        averageLoginsPerUser: round2(engagement[0]?.avgTransactionsPerUser || 0),
        averageTransactionsPerUser: totalUsers ? round2(totalTransactions / totalUsers) : 0,
        categorizationAccuracy: feedback.accuracy,
      },
      recentUsers,
      services: { ai: aiService.status(), email: emailService.status() },
    },
    'Admin dashboard loaded',
  );
});

/* ───────────────────────────────── Users ─────────────────────────────── */

/** GET /api/admin/users?search=&status=&page= */
const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 15);
  const { search, status, role = 'student', sort = 'createdAt' } = req.query;

  const query = {};
  if (role !== 'all') query.role = role;
  if (status === 'active') query.isActive = true;
  if (status === 'disabled') query.isActive = false;
  if (search) {
    const safe = String(search).trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ name: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ [sort === 'name' ? 'name' : sort === 'lastLoginAt' ? 'lastLoginAt' : 'createdAt']: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  // Attach per-user usage so the table can show more than the profile fields.
  const ids = users.map((u) => u._id);
  const [txCounts, budgetCounts] = await Promise.all([
    Transaction.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', count: { $sum: 1 }, total: { $sum: '$amount' } } }]),
    Budget.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', count: { $sum: 1 } } }]),
  ]);
  const txMap = new Map(txCounts.map((t) => [String(t._id), t]));
  const budgetMap = new Map(budgetCounts.map((b) => [String(b._id), b.count]));

  return paginated(
    res,
    users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      academicYear: u.academicYear,
      university: u.university,
      isActive: u.isActive,
      disabledReason: u.disabledReason,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      loginCount: u.loginCount,
      transactionCount: txMap.get(String(u._id))?.count || 0,
      transactionTotal: round2(txMap.get(String(u._id))?.total || 0),
      budgetCount: budgetMap.get(String(u._id)) || 0,
    })),
    { page, limit, total },
    'Users loaded',
  );
});

/** GET /api/admin/users/:id */
const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound('User not found');
  delete user.password;

  const [summary, categories, budgets, goals, activity, insights, recentTransactions] = await Promise.all([
    analytics.summaryWithComparisons(user._id, new Date(), '$'),
    Category.countDocuments({ user: user._id }),
    Budget.find({ user: user._id }).populate('category', 'name color').limit(20).lean(),
    require('../models/SavingsGoal').find({ user: user._id }).lean(),
    ActivityLog.find({ user: user._id }).sort({ createdAt: -1 }).limit(15).lean(),
    Insight.find({ user: user._id }).sort({ month: -1 }).limit(6).select('month title source metrics').lean(),
    Transaction.find({ user: user._id }).sort({ date: -1 }).limit(10).populate('category', 'name color icon').lean(),
  ]);

  return ok(
    res,
    {
      user: { ...user, id: user._id },
      usage: {
        categories,
        budgets: budgets.length,
        goals: goals.length,
        transactions: summary.lifetime.count,
        lifetimeIncome: summary.lifetime.income,
        lifetimeExpense: summary.lifetime.expense,
        balance: summary.lifetime.balance,
        memberSince: summary.lifetime.since,
      },
      summary,
      budgets,
      goals,
      activity,
      insights,
      recentTransactions,
    },
    'User detail',
  );
});

/** PATCH /api/admin/users/:id/status — enable / disable */
const setUserStatus = asyncHandler(async (req, res) => {
  const { isActive, reason = '' } = req.body;
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You cannot disable your own admin account');

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin' && !isActive) throw ApiError.forbidden('Admin accounts cannot be disabled from this screen');

  user.isActive = Boolean(isActive);
  user.disabledReason = isActive ? '' : reason || 'Disabled by an administrator';
  await user.save({ validateBeforeSave: false });

  if (!isActive) {
    await notificationService.notify({
      user: user._id,
      type: 'announcement',
      title: 'Your account has been disabled',
      message: user.disabledReason,
      severity: 'danger',
      dedupeKey: `disabled:${user._id}:${Date.now()}`,
    });
  }

  return ok(res, { user: { id: user._id, name: user.name, isActive: user.isActive } }, isActive ? 'Account enabled' : 'Account disabled');
});

/** POST /api/admin/users/:id/reset-password */
const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) throw ApiError.badRequest('Provide a temporary password of at least 8 characters');

  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  user.password = newPassword;
  await user.save();

  await notificationService.notify({
    user: user._id,
    type: 'announcement',
    title: 'Your password was reset by an administrator',
    message: 'Sign in with the temporary password you were given and change it from Settings → Security.',
    severity: 'warning',
    link: '/settings',
    dedupeKey: `admin-reset:${user._id}:${Date.now()}`,
  });

  return ok(res, { email: user.email }, `Password reset for ${user.email}. Share the temporary password securely.`);
});

/** GET /api/admin/users/:id/activity */
const getUserActivity = asyncHandler(async (req, res) => {
  const logs = await ActivityLog.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 50).lean();
  return ok(res, { activity: logs }, 'User activity');
});

/* ─────────────────────── Category templates ──────────────────────────── */

/** GET /api/admin/categories */
const listTemplates = asyncHandler(async (_req, res) => {
  const templates = await Category.find({ isTemplate: true }).sort({ type: 1, order: 1 }).lean();
  const usage = await Category.aggregate([
    { $match: { user: { $ne: null } } },
    { $group: { _id: '$name', students: { $sum: 1 } } },
  ]);
  const usageMap = new Map(usage.map((u) => [u._id.toLowerCase(), u.students]));
  return ok(
    res,
    {
      templates: templates.map((t) => ({ ...t, id: t._id, studentsUsing: usageMap.get(t.name.toLowerCase()) || 0 })),
      options: { icons: CATEGORY_ICON_CHOICES, colors: CATEGORY_COLOR_CHOICES },
      defaults: DEFAULT_CATEGORIES,
    },
    'Category templates loaded',
  );
});

/** POST /api/admin/categories */
const createTemplate = asyncHandler(async (req, res) => {
  const { name, type, icon, color, keywords, monthlyBudgetHint } = req.body;
  const existing = await Category.findOne({ isTemplate: true, type, name: new RegExp(`^${String(name).trim()}$`, 'i') });
  if (existing) throw ApiError.conflict('A default category with that name and type already exists');

  const count = await Category.countDocuments({ isTemplate: true, type });
  const template = await Category.create({
    user: null,
    name: String(name).trim(),
    type,
    icon: icon || 'Package',
    color: color || '#6D5DFB',
    keywords: Array.isArray(keywords) ? keywords.map((k) => String(k).toLowerCase()) : [],
    monthlyBudgetHint: Number(monthlyBudgetHint) || 0,
    isTemplate: true,
    isDefault: true,
    order: count,
  });

  return created(res, { template }, 'Default category added — new students will receive it automatically');
});

/** PUT /api/admin/categories/:id */
const updateTemplate = asyncHandler(async (req, res) => {
  const template = await Category.findOne({ _id: req.params.id, isTemplate: true });
  if (!template) throw ApiError.notFound('Default category not found');

  const { name, icon, color, keywords, monthlyBudgetHint, isArchived } = req.body;
  if (name) template.name = String(name).trim();
  if (icon) template.icon = icon;
  if (color) template.color = color;
  if (monthlyBudgetHint !== undefined) template.monthlyBudgetHint = Math.max(0, Number(monthlyBudgetHint) || 0);
  if (Array.isArray(keywords)) template.keywords = keywords.map((k) => String(k).toLowerCase());
  if (isArchived !== undefined) template.isArchived = Boolean(isArchived);

  await template.save();
  return ok(res, { template }, 'Default category updated');
});

/** DELETE /api/admin/categories/:id */
const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await Category.findOne({ _id: req.params.id, isTemplate: true });
  if (!template) throw ApiError.notFound('Default category not found');
  await template.deleteOne();
  return ok(res, { id: template._id }, 'Default category removed. Existing student categories are untouched.');
});

/** POST /api/admin/categories/apply-to-all — push a new default to every student. */
const applyToAllStudents = asyncHandler(async (req, res) => {
  const templates = await Category.find({ isTemplate: true, isArchived: false }).lean();
  const students = await User.find({ role: 'student', isActive: true }).select('_id').lean();

  let created = 0;
  for (const student of students) {
    const existing = await Category.find({ user: student._id }).select('name type').lean();
    const have = new Set(existing.map((c) => `${c.type}:${c.name.toLowerCase()}`));
    const missing = templates.filter((t) => !have.has(`${t.type}:${t.name.toLowerCase()}`));
    if (!missing.length) continue;
    // eslint-disable-next-line no-await-in-loop
    await Category.insertMany(missing.map((t) => ({
      user: student._id, name: t.name, type: t.type, icon: t.icon, color: t.color,
      keywords: t.keywords, isDefault: true, order: t.order, monthlyBudgetHint: t.monthlyBudgetHint,
    })));
    created += missing.length;
  }

  return ok(res, { students: students.length, created }, `Applied defaults to ${students.length} students (${created} categories added)`);
});

/* ────────────────────────── Announcements ────────────────────────────── */

/** GET /api/admin/announcements */
const listAnnouncements = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status === 'published') query.isPublished = true;
  if (req.query.status === 'draft') query.isPublished = false;
  const announcements = await Announcement.find(query).sort({ createdAt: -1 }).populate('createdBy', 'name email').lean();
  return ok(res, { announcements }, 'Announcements loaded');
});

/** POST /api/admin/announcements */
const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, kind, audience, severity, link, publish } = req.body;
  const announcement = await Announcement.create({
    title, body, kind: kind || 'announcement', audience: audience || 'all',
    severity: severity || 'info', link: link || '',
    isPublished: Boolean(publish),
    publishedAt: publish ? new Date() : null,
    createdBy: req.user._id,
  });
  const recipients = publish ? await broadcast(announcement) : 0;
  return created(res, { announcement, recipients }, publish ? `Published to ${recipients} students` : 'Draft saved');
});

/** PUT /api/admin/announcements/:id */
const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found');

  ['title', 'body', 'kind', 'audience', 'severity', 'link'].forEach((field) => {
    if (req.body[field] !== undefined) announcement[field] = req.body[field];
  });
  if (req.body.expiresAt !== undefined) announcement.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

  let recipients = 0;
  if (req.body.publish === true && !announcement.isPublished) {
    announcement.isPublished = true;
    announcement.publishedAt = new Date();
    recipients = await broadcast(announcement);
  } else if (req.body.publish === false) {
    announcement.isPublished = false;
    announcement.publishedAt = null;
  }

  await announcement.save();
  return ok(res, { announcement, recipients }, announcement.isPublished ? 'Announcement updated and published' : 'Announcement updated (draft)');
});

/** DELETE /api/admin/announcements/:id */
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return ok(res, { id: announcement._id }, 'Announcement deleted');
});

/** Broadcast a published announcement to the audience and record the count. */
async function broadcast(announcement) {
  const query = { role: 'student', isActive: true };
  if (announcement.audience === 'admins') query.role = 'admin';
  if (announcement.audience === 'new_users') query.createdAt = { $gte: new Date(Date.now() - 30 * 86400000) };

  const users = await User.find(query).select('_id').lean();
  let delivered = 0;
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    const result = await notificationService.notify({
      user: user._id,
      type: 'announcement',
      title: announcement.title,
      message: announcement.body,
      severity: announcement.severity,
      link: announcement.link || '/dashboard',
      dedupeKey: `announcement:${announcement._id}:${user._id}`,
    });
    if (result) delivered += 1;
  }
  announcement.stats.recipients = delivered;
  await announcement.save();
  return delivered;
}

/* ──────────────────────────── Analytics ─────────────────────────────── */

/** GET /api/admin/analytics?months=6 */
const analyticsOverview = asyncHandler(async (req, res) => {
  const months = Math.min(12, Math.max(3, Number(req.query.months) || 6));
  const range = lastMonths(months);

  const [userGrowth, volume, categoryPopularity, incomeVsExpense, activityByDay, categorization, topStudents] = await Promise.all([
    User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, users: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      { $match: { date: { $gte: range[0] } } },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'expense', date: { $gte: range[0] } } },
      { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ['$category.name', 'Unknown'] }, color: { $ifNull: ['$category.color', '#94A3B8'] }, type: 'expense', count: 1, total: { $round: ['$total', 2] } } },
    ]),
    Transaction.aggregate([
      { $match: { date: { $gte: range[0] } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    ActivityLog.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, actions: { $sum: 1 }, users: { $addToSet: '$user' } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', actions: 1, activeUsers: { $size: '$users' } } },
    ]),
    CategorizationFeedback.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 }, accepted: { $sum: { $cond: ['$accepted', 1, 0] } } } },
    ]),
    Transaction.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ['$user.name', 'Deleted student'] }, email: { $ifNull: ['$user.email', ''] }, count: 1, total: { $round: ['$total', 2] } } },
    ]),
  ]);

  const volumeMap = new Map(volume.map((v) => [`${v._id.month}:${v._id.type}`, v]));
  const usersByMonth = new Map(userGrowth.map((u) => [u._id, u.users]));

  // Cumulative growth so the chart shows total students over time.
  let cumulative = userGrowth.filter((u) => u._id < monthKey(range[0])).reduce((s, u) => s + u.users, 0);

  return ok(
    res,
    {
      range: { from: range[0], months },
      userGrowth: range.map((m) => {
        const key = monthKey(m);
        cumulative += usersByMonth.get(key) || 0;
        return { key, label: shortMonthLabel(m), newUsers: usersByMonth.get(key) || 0, totalUsers: cumulative };
      }),
      transactionVolume: range.map((m) => {
        const key = monthKey(m);
        return {
          key,
          label: shortMonthLabel(m),
          income: round2(volumeMap.get(`${key}:income`)?.total || 0),
          expense: round2(volumeMap.get(`${key}:expense`)?.total || 0),
          count: (volumeMap.get(`${key}:income`)?.count || 0) + (volumeMap.get(`${key}:expense`)?.count || 0),
        };
      }),
      categoryPopularity,
      incomeVsExpense: incomeVsExpense.map((r) => ({ type: r._id, total: round2(r.total), count: r.count })),
      activityByDay,
      categorization: categorization.map((c) => ({ source: c._id, count: c.count, accepted: c.accepted, accuracy: c.count ? round2((c.accepted / c.count) * 100) : 0 })),
      topStudents,
      contentType: {
        insights: await Insight.countDocuments(),
        tips: await SavingTip.countDocuments(),
        categories: await Category.countDocuments({ isTemplate: true }),
        announcements: await Announcement.countDocuments({ isPublished: true }),
      },
    },
    'Analytics loaded',
  );
});

/** GET /api/admin/transactions — moderation view across all students. */
const listAllTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const match = {};
  if (req.query.type) match.type = req.query.type;
  if (req.query.anomalies === 'true') match.isAnomaly = true;
  if (req.query.search) match.description = { $regex: String(req.query.search).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const [items, total] = await Promise.all([
    Transaction.find(match)
      .populate('user', 'name email')
      .populate('category', 'name color icon')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(match),
  ]);

  return paginated(res, items, { page, limit, total }, 'Transactions loaded');
});

/** POST /api/admin/maintenance/recompute-insights — refresh insights for everyone. */
const recomputeInsights = asyncHandler(async (req, res) => {
  const userIds = await Transaction.distinct('user');
  const insightsService = require('../services/insightsService');
  let generated = 0;
  for (const id of userIds.slice(0, 200)) {
    // eslint-disable-next-line no-await-in-loop
    const insight = await insightsService.generateForMonth(id, new Date(), { force: true, useAi: req.body.useAi === true }).catch(() => null);
    if (insight) generated += 1;
  }
  return ok(res, { students: userIds.length, generated }, `Insights refreshed for ${generated} of ${userIds.length} students`);
});

module.exports = {
  dashboard,
  listUsers,
  getUserDetail,
  setUserStatus,
  resetUserPassword,
  getUserActivity,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyToAllStudents,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  analyticsOverview,
  listAllTransactions,
  recomputeInsights,
};
