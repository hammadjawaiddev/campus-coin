/* eslint-disable no-console */
/**
 * Campus Coin database seeder.
 *
 *   npm run seed          → idempotent: creates missing data, keeps existing
 *   npm run seed:fresh    → wipes Campus Coin collections first
 *
 * Creates:
 *   • global category templates (the admin-managed default set)
 *   • demo student  demo@campuscoin.com  with 8 months of realistic history
 *   • demo admin    admin@campuscoin.com
 *   • budgets, savings goals, insights, tips, notifications, announcements
 *   • a sample CSV file for the importer demo
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { logger } = require('../utils/logger');
const { DEFAULT_CATEGORIES } = require('../config/constants');
const { startOfMonthUTC, addMonthsUTC, monthKey } = require('../utils/date');

const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const Insight = require('../models/Insight');
const SavingTip = require('../models/SavingTip');
const Notification = require('../models/Notification');
const Bookmark = require('../models/Bookmark');
const Announcement = require('../models/Announcement');
const ActivityLog = require('../models/ActivityLog');
const CategorizationFeedback = require('../models/CategorizationFeedback');

const demoData = require('./demoData');
const tipsEngine = require('../services/tipsEngine');
const insightsService = require('../services/insightsService');
const analytics = require('../services/analyticsService');

const DEMO_EMAIL = 'demo@campuscoin.com';
const ADMIN_EMAIL = 'admin@campuscoin.com';

const DEMO_TEMPLATE_BUDGETS = [
  { name: 'Food', limit: 240 },
  { name: 'Transport', limit: 70 },
  { name: 'Entertainment', limit: 80 },
  { name: 'Academics', limit: 90 },
  { name: 'Subscriptions', limit: 40 },
  { name: 'Hostel/Rent', limit: 170 },
];

async function wipe() {
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Transaction.deleteMany({}),
    Budget.deleteMany({}),
    SavingsGoal.deleteMany({}),
    Insight.deleteMany({}),
    SavingTip.deleteMany({}),
    Notification.deleteMany({}),
    Bookmark.deleteMany({}),
    Announcement.deleteMany({}),
    ActivityLog.deleteMany({}),
    CategorizationFeedback.deleteMany({}),
  ]);
  logger.info('All Campus Coin collections cleared');
}

/** Admin-managed default categories available to every student. */
async function seedTemplates() {
  await Category.deleteMany({ isTemplate: true });
  const templates = await Category.insertMany(
    DEFAULT_CATEGORIES.map((category, index) => ({
      user: null,
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      keywords: category.keywords,
      isTemplate: true,
      isDefault: true,
      order: index,
      monthlyBudgetHint: category.type === 'expense' ? Math.round(60 + index * 10) : 0,
    })),
  );
  logger.info(`Seeded ${templates.length} global category templates`);
  return templates;
}

/** Personal copy of the templates owned by the student. */
async function createCategoriesFor(user, templates) {
  const docs = await Category.insertMany(
    templates.map((t) => ({
      user: user._id,
      name: t.name,
      type: t.type,
      icon: t.icon,
      color: t.color,
      keywords: t.keywords,
      isDefault: true,
      order: t.order,
      monthlyBudgetHint: t.monthlyBudgetHint,
    })),
  );
  return docs;
}

async function seedDemoStudent(templates, { months = 8 } = {}) {
  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    logger.info(`Demo student already exists (${DEMO_EMAIL}) — skipping student seed`);
    return existing;
  }

  const student = await User.create({
    name: 'Ayesha Khan',
    email: DEMO_EMAIL,
    password: env.SEED_DEMO_PASSWORD,
    role: 'student',
    academicYear: '3rd Year',
    university: 'NED University of Engineering & Technology',
    monthlyAllowance: 350,
    savingsGoal: 1200,
    avatar: { color: '#6D5DFB' },
    preferences: { currency: 'USD', theme: 'system', fontSize: 'base', reducedMotion: false, emailAlerts: true, weeklyDigest: true },
    onboarding: { completed: true, completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) },
    streak: { current: 4, longest: 11, lastLoggedDate: new Date() },
    loginCount: 12,
    lastLoginAt: new Date(),
  });

  const categories = await createCategoriesFor(student, templates);
  const categoryIdByName = new Map(categories.map((c) => [c.name, c._id]));

  // ── Transactions ─────────────────────────────────────────────────────────
  const { transactions, incomeTotal, expenseTotal } = demoData.generateTransactions({
    now: new Date(),
    months,
    categoryIdByName,
  });

  const withUser = transactions.map((t) => ({ ...t, user: student._id }));
  await Transaction.insertMany(withUser, { ordered: false });
  logger.info(`Seeded ${withUser.length} transactions (income ${incomeTotal.toFixed(2)}, expense ${expenseTotal.toFixed(2)})`);

  // ── Budgets for the current + previous month ─────────────────────────────
  const currentMonth = startOfMonthUTC(new Date());
  const previousMonth = addMonthsUTC(currentMonth, -1);
  const budgetDocs = [
    ...demoData.generateBudgets({ month: currentMonth, categoryIdByName, templateBudgets: DEMO_TEMPLATE_BUDGETS }),
    ...demoData.generateBudgets({ month: previousMonth, categoryIdByName, templateBudgets: DEMO_TEMPLATE_BUDGETS }),
  ].map((b) => ({
    user: student._id,
    category: b.category,
    month: b.month,
    type: 'expense',
    limitAmount: b.limitAmount,
    alertThreshold: 80,
  }));
  await Budget.insertMany(budgetDocs);
  logger.info(`Seeded ${budgetDocs.length} budgets`);

  // ── Savings goals ────────────────────────────────────────────────────────
  await SavingsGoal.insertMany([
    {
      user: student._id,
      name: 'New laptop fund',
      targetAmount: 1200,
      currentAmount: 540,
      targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
      color: '#22C55E',
      icon: 'Laptop',
      isPrimary: true,
      note: 'For final-year project work and freelancing.',
      milestones: [
        { percent: 25, reachedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90) },
        { percent: 40, reachedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
      ],
    },
    {
      user: student._id,
      name: 'Semester trip to the north',
      targetAmount: 300,
      currentAmount: 120,
      targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
      color: '#0EA5E9',
      icon: 'Plane',
      note: 'Split with three classmates.',
      milestones: [{ percent: 25, reachedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20) }],
    },
  ]);
  logger.info('Seeded 2 savings goals');

  // ── Intelligence: insights + tips ────────────────────────────────────────
  for (let i = 2; i >= 0; i -= 1) {
    // eslint-disable-next-line no-await-in-loop
    await insightsService.generateForMonth(student._id, addMonthsUTC(currentMonth, -i), { currency: '$', force: true, useAi: false });
  }
  const tips = await tipsEngine.generate(student._id, { month: currentMonth, currency: '$' });
  logger.info(`Generated insights for 3 months and ${tips.length} saving tips`);

  // Pin and bookmark a couple so the UI states are visible in the demo.
  if (tips[0]) await SavingTip.updateOne({ _id: tips[0]._id }, { $set: { pinned: true } });
  if (tips[1]) {
    await SavingTip.updateOne({ _id: tips[1]._id }, { $set: { bookmarked: true } });
    const Bookmark = require('../models/Bookmark');
    await Bookmark.create({
      user: student._id, itemType: 'tip', itemId: tips[1]._id, title: tips[1].title, body: tips[1].body,
      meta: { severity: tips[1].severity, potentialSaving: tips[1].potentialSaving },
    });
  }

  // Bookmark the most recent insight as well.
  const insight = await Insight.findOne({ user: student._id }).sort({ month: -1 });
  if (insight) {
    insight.bookmarked = true;
    await insight.save();
    await Bookmark.create({
      user: student._id, itemType: 'insight', itemId: insight._id,
      title: insight.title, body: insight.summaryText, meta: { month: monthKey(insight.month), source: insight.source },
    });
  }

  // ── Notifications ────────────────────────────────────────────────────────
  const monthPerf = await analytics.budgetPerformance(student._id, currentMonth, '$');
  const overBudget = monthPerf.rows.filter((r) => r.status !== 'safe').slice(0, 3);
  const notifications = [
    {
      user: student._id, type: 'welcome', severity: 'success', read: true, readAt: new Date(),
      title: 'Welcome to Campus Coin, Ayesha! 🎉',
      message: 'Your dashboard is powered by real transaction data — log an entry to see it move.',
      link: '/dashboard', dedupeKey: `seed:welcome:${student._id}`,
    },
    ...overBudget.map((row) => ({
      user: student._id,
      type: row.status === 'over' ? 'budget_exceeded' : 'budget_near',
      severity: row.status === 'over' ? 'danger' : 'warning',
      title: row.status === 'over' ? `${row.categoryName} budget exceeded` : `${row.categoryName} budget at ${Math.round(row.percentUsed)}%`,
      message:
        row.status === 'over'
          ? `You are $${Math.abs(row.remaining).toFixed(2)} over your $${row.limit.toFixed(2)} ${row.categoryName} budget this month.`
          : `Only $${Math.max(0, row.remaining).toFixed(2)} left in your $${row.limit.toFixed(2)} ${row.categoryName} budget.`,
      link: '/budgets',
      read: false,
      dedupeKey: `seed:${row.status}:${row.categoryId}:${monthKey(currentMonth)}`,
    })),
    {
      user: student._id, type: 'insight', severity: 'info', read: false,
      title: 'Your new monthly insight is ready',
      message: insight?.title || 'A fresh plain-language summary of your month is available.',
      link: '/insights', dedupeKey: `seed:insight:${monthKey(currentMonth)}`,
    },
    {
      user: student._id, type: 'large_transaction', severity: 'warning', read: false,
      title: 'Unusually large transaction detected',
      message: 'A $210.00 Miscellaneous transaction is about 3x your usual spend in this category.',
      link: '/transactions', dedupeKey: `seed:large:${monthKey(currentMonth)}`,
    },
    {
      user: student._id, type: 'savings_milestone', severity: 'success', read: true, readAt: new Date(),
      title: '40% of "New laptop fund" saved! 🏆',
      message: 'You have now saved $540.00 towards your laptop fund. Keep the momentum going.',
      link: '/goals', dedupeKey: `seed:milestone:${monthKey(currentMonth)}`,
    },
  ];
  await Notification.insertMany(notifications);
  logger.info(`Seeded ${notifications.length} notifications`);

  // ── Activity log (recently viewed / edited) ──────────────────────────────
  const recentTx = await Transaction.find({ user: student._id }).sort({ date: -1 }).limit(8).lean();
  await ActivityLog.insertMany(
    recentTx.map((t, i) => ({
      user: student._id,
      action: i % 3 === 0 ? 'update' : 'view',
      entity: 'transaction',
      entityId: t._id,
      label: t.description || 'Transaction',
      createdAt: new Date(Date.now() - i * 1000 * 60 * 37),
    })),
  );

  // ── Categorisation feedback (so AI/rule suggestions look "learned") ──────
  const foodId = categoryIdByName.get('Food');
  const transportId = categoryIdByName.get('Transport');
  const subId = categoryIdByName.get('Subscriptions');
  await CategorizationFeedback.insertMany([
    { user: student._id, description: 'campus cafe burger', tokens: ['campus', 'cafe', 'burger'], confirmedCategory: foodId, source: 'rules', accepted: true, confidence: 0.8 },
    { user: student._id, description: 'late night shawarma', tokens: ['late', 'night', 'shawarma'], confirmedCategory: foodId, source: 'manual', accepted: false, confidence: 0.4 },
    { user: student._id, description: 'metro card top up', tokens: ['metro', 'card', 'top'], confirmedCategory: transportId, source: 'rules', accepted: true, confidence: 0.75 },
    { user: student._id, description: 'netflix monthly payment', tokens: ['netflix', 'monthly'], confirmedCategory: subId, source: 'rules', accepted: true, confidence: 0.9 },
  ]);

  logger.info(`Demo student ready → ${DEMO_EMAIL}`);
  return student;
}

async function seedAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    logger.info(`Admin already exists (${ADMIN_EMAIL}) — skipping`);
    return existing;
  }
  const admin = await User.create({
    name: 'Campus Coin Admin',
    email: ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    role: 'admin',
    academicYear: null,
    preferences: { currency: 'USD', theme: 'dark', fontSize: 'base', reducedMotion: false, emailAlerts: true, weeklyDigest: false },
    onboarding: { completed: true, completedAt: new Date() },
  });
  logger.info(`Admin ready → ${ADMIN_EMAIL}`);
  return admin;
}

async function seedAnnouncements(admin) {
  const count = await Announcement.countDocuments();
  if (count) {
    logger.info('Announcements already present — skipping');
    return;
  }
  await Announcement.insertMany([
    {
      title: 'Welcome to the Campus Coin pilot',
      body: 'Log at least five expenses this week to unlock your first personalised insight. The more you log, the sharper the tips get.',
      kind: 'announcement', audience: 'all', severity: 'info', isPublished: true, publishedAt: new Date(),
      createdBy: admin._id, stats: { recipients: 1 },
    },
    {
      title: 'Tip of the week: audit your subscriptions',
      body: 'Streaming and app plans renew silently. Check the Subscriptions category — cancelling one unused plan is the fastest saving most students find.',
      kind: 'tip', audience: 'all', severity: 'success', isPublished: true, publishedAt: new Date(),
      createdBy: admin._id, stats: { recipients: 1 },
    },
    {
      title: 'Mid-semester budget check',
      body: 'Draft announcement — review before publishing so it lands right after mid-terms.',
      kind: 'announcement', audience: 'all', severity: 'info', isPublished: false,
      createdBy: admin._id, stats: { recipients: 0 },
    },
  ]);
  logger.info('Seeded 3 announcements (2 published, 1 draft)');
}

async function writeSampleCsv() {
  const dir = path.resolve(__dirname, '../../../sample-data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'campus-coin-sample-transactions.csv');
  fs.writeFileSync(file, demoData.sampleCsv('$'), 'utf8');
  logger.info(`Sample CSV written → ${file}`);
}

async function run() {
  const fresh = process.argv.includes('--fresh');
  try {
    await connectDB();
    if (fresh) await wipe();

    const templates = await seedTemplates();
    await seedAdmin().then((admin) => seedAnnouncements(admin));
    await seedDemoStudent(templates);
    await writeSampleCsv();

    const counts = {
      users: await User.countDocuments(),
      categories: await Category.countDocuments(),
      transactions: await Transaction.countDocuments(),
      budgets: await Budget.countDocuments(),
      goals: await SavingsGoal.countDocuments(),
      insights: await Insight.countDocuments(),
      tips: await SavingTip.countDocuments(),
      notifications: await Notification.countDocuments(),
    };
    console.log('\n──────────────────────────────────────────────');
    console.log(' Campus Coin seed complete');
    console.log('──────────────────────────────────────────────');
    console.log(` Users         : ${counts.users}`);
    console.log(` Categories    : ${counts.categories} (incl. ${DEFAULT_CATEGORIES.length} templates)`);
    console.log(` Transactions  : ${counts.transactions}`);
    console.log(` Budgets       : ${counts.budgets}`);
    console.log(` Savings goals : ${counts.goals}`);
    console.log(` Insights      : ${counts.insights}`);
    console.log(` Saving tips   : ${counts.tips}`);
    console.log(` Notifications : ${counts.notifications}`);
    console.log('──────────────────────────────────────────────');
    console.log(' Demo student  : demo@campuscoin.com  /', env.SEED_DEMO_PASSWORD);
    console.log(' Demo admin    : admin@campuscoin.com /', env.SEED_ADMIN_PASSWORD);
    console.log('──────────────────────────────────────────────\n');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) run();

module.exports = { run, seedTemplates, seedDemoStudent, seedAdmin, DEMO_EMAIL, ADMIN_EMAIL };
