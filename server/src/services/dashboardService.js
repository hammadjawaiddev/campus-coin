const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const SavingTip = require('../models/SavingTip');
const Insight = require('../models/Insight');
const Category = require('../models/Category');
const analytics = require('./analyticsService');
const tipsEngine = require('./tipsEngine');
const insightsService = require('./insightsService');
const detection = require('./detectionService');
const notificationService = require('./notificationService');
const recurringService = require('./recurringService');
const { currencySymbol } = require('./transactionService');
const { startOfMonthUTC, endOfMonthUTC, monthKey, shortMonthLabel, dayLabel } = require('../utils/date');
const { round2, percentChange, percentOf } = require('../utils/number');
const { logger } = require('../utils/logger');

/**
 * Composes the single dashboard payload. One round-trip keeps the first paint
 * fast and lets the client render skeleton-free (aside from the initial load).
 *
 * `refresh` controls the expensive intelligence calls: the dashboard triggers
 * tip/insight regeneration at most once per hour per student.
 */

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

async function getDashboard(user, { month = new Date(), refresh = false } = {}) {
  const userId = user._id;
  const currency = currencySymbol(user);
  const monthStart = startOfMonthUTC(month);

  // Lazily materialise any recurring entries that came due.
  await recurringService.runForUser(userId).catch((e) => logger.debug('recurring sweep skipped:', e.message));

  const [summary, budgets, trend, goals, unread, recent, alerts, categories] = await Promise.all([
    analytics.summaryWithComparisons(userId, monthStart, currency),
    analytics.budgetPerformance(userId, monthStart, currency),
    analytics.monthlyTrend(userId, 6, monthStart),
    SavingsGoal.find({ user: userId, status: 'active' }).sort({ isPrimary: -1, createdAt: 1 }).limit(4).lean(),
    notificationService.unreadCount(userId),
    Transaction.find({ user: userId }).populate('category', 'name color icon type').sort({ date: -1, _id: -1 }).limit(6).lean(),
    notificationService.list(userId, { limit: 6 }),
    Category.countDocuments({ user: userId, isArchived: false }),
  ]);

  // ── Intelligence: generate tips / insight at most hourly ─────────────────
  const latestInsight = await Insight.findOne({ user: userId, status: 'active' }).sort({ month: -1 }).lean();
  const latestTipAt = await SavingTip.findOne({ user: userId, month: monthStart }).sort({ updatedAt: -1 }).select('updatedAt').lean();
  const stale = refresh || !latestTipAt || Date.now() - new Date(latestTipAt.updatedAt).getTime() > REFRESH_INTERVAL_MS;

  const tips = stale
    ? await tipsEngine.generate(userId, { month: monthStart, currency })
    : await tipsEngine.list(userId, { month: monthStart, limit: 6 });

  const insight =
    stale || !latestInsight
      ? await insightsService.generateForMonth(userId, monthStart, { currency }).catch((error) => {
          logger.warn('insight generation failed:', error.message);
          return latestInsight;
        })
      : latestInsight;

  const [weekly, spendingIncreases, forecast, goalStats] = await Promise.all([
    Promise.resolve(analytics.weeklyBuckets(monthStart, summary.current.daily)),
    detection.checkSpendingIncrease(userId),
    detection.forecastNextMonth(userId),
    buildGoalStats(goals, summary),
  ]);

  const topCategory = summary.current.topCategory;
  const topCategoryChange = topCategory
    ? percentChange(topCategory.total, summary.previous.expenseByCategory.find((c) => c.name === topCategory.name)?.total || 0)
    : 0;

  const insightsNarrative = buildNarratives({
    summary,
    currency,
    topCategory,
    topCategoryChange,
    budgets,
    goals,
    spendingIncreases,
  });

  return {
    meta: {
      month: monthStart,
      monthKey: monthKey(monthStart),
      monthLabel: shortMonthLabel(monthStart),
      currency,
      generatedAt: new Date(),
      refreshed: stale,
    },
    student: {
      id: user._id,
      name: user.name,
      firstName: user.name.split(' ')[0],
      email: user.email,
      academicYear: user.academicYear,
      monthlyAllowance: round2(user.monthlyAllowance || 0),
      savingsGoalTarget: round2(user.savingsGoal || 0),
      avatar: user.avatar,
      streak: user.streak,
      onboarding: user.onboarding,
      memberSince: user.createdAt,
    },
    summary: {
      balance: summary.lifetime.balance,
      lifetimeIncome: summary.lifetime.income,
      lifetimeExpense: summary.lifetime.expense,
      lifetimeTransactions: summary.lifetime.count,
      month: summary.current,
      previousMonth: summary.previous,
      incomeChange: summary.current.incomeChange,
      expenseChange: summary.current.expenseChange,
      mtdExpenseChange: summary.current.mtdExpenseChange,
      mtdExpense: summary.current.mtdExpense,
      isPartialMonth: summary.current.isPartialMonth,
      daysElapsed: summary.current.daysElapsed,
      netChange: summary.current.netChange,
      averageMonthlyExpense: summary.averageMonthlyExpense,
      unspentAllowance: user.monthlyAllowance ? round2(user.monthlyAllowance - summary.current.expense) : null,
    },
    charts: {
      daily: summary.current.daily.map((d) => ({ ...d, day: dayLabel(d.date) })),
      trend,
      categoryShare: summary.current.expenseByCategory.map((c) => ({
        name: c.name,
        value: c.total,
        share: c.share,
        color: c.color,
        icon: c.icon,
        count: c.count,
        categoryId: c.categoryId,
      })),
      weekly,
      budgetVsActual: budgets.rows.map((r) => ({
        name: r.categoryName,
        limit: r.limit,
        spent: r.spent,
        color: r.color,
        percentUsed: r.percentUsed,
        status: r.status,
      })),
    },
    widgets: {
      topCategory: topCategory
        ? {
            ...topCategory,
            changePercent: topCategoryChange,
            headline: `${topCategory.name} is your top category at ${currency}${topCategory.total.toFixed(2)} (${topCategory.share}% of spend)`,
          }
        : null,
      budgets: { rows: budgets.rows, summary: budgets.summary },
      alerts: {
        unread,
        items: alerts.map((a) => ({
          id: a._id,
          type: a.type,
          severity: a.severity,
          title: a.title,
          message: a.message,
          link: a.link,
          createdAt: a.createdAt,
          read: a.read,
        })),
      },
      recentTransactions: recent.map((t) => ({
        id: t._id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        date: t.date,
        notes: t.notes,
        category: t.category ? { id: t.category._id, name: t.category.name, color: t.category.color, icon: t.category.icon } : null,
        isAnomaly: t.isAnomaly,
      })),
      tips: tips.slice(0, 4).map(serialiseTip),
      insight: insight ? serialiseInsight(insight, currency) : null,
      goals: goalStats,
      spendingIncreases,
      forecast,
      narratives: insightsNarrative,
      counts: {
        transactionsThisMonth: summary.current.transactionCount,
        activeBudgets: budgets.summary.budgetCount,
        categories,
        goals: goals.length,
      },
    },
  };
}

const serialiseTip = (tip) => ({
  id: tip._id,
  title: tip.title,
  body: tip.body,
  severity: tip.severity,
  categoryName: tip.categoryName,
  potentialSaving: tip.potentialSaving,
  impactScore: tip.impactScore,
  pinned: tip.pinned,
  bookmarked: tip.bookmarked,
  actionLabel: tip.actionLabel,
  actionHref: tip.actionHref,
  createdAt: tip.createdAt,
});

const serialiseInsight = (insight, currency) => ({
  id: insight._id,
  month: insight.month,
  monthLabel: shortMonthLabel(insight.month),
  title: insight.title,
  summaryText: insight.summaryText,
  tipText: insight.tipText,
  highlights: insight.highlights,
  metrics: insight.metrics,
  source: insight.source,
  bookmarked: insight.bookmarked,
  status: insight.status,
  currency,
  generatedAt: insight.updatedAt || insight.createdAt,
});

/** Savings goal cards with pace analysis. */
async function buildGoalStats(goals, summary) {
  const monthlyContribution = summary.current.net > 0 ? summary.current.net : summary.averageMonthlyExpense ? 0 : 0;
  return goals.map((goal) => {
    const progress = Math.min(100, percentOf(goal.currentAmount, goal.targetAmount));
    const remaining = round2(Math.max(0, goal.targetAmount - goal.currentAmount));
    const monthsLeft = goal.targetDate
      ? Math.max(0, Math.round((new Date(goal.targetDate) - new Date()) / (30 * 86400000)))
      : null;
    const requiredMonthly = monthsLeft ? round2(remaining / Math.max(1, monthsLeft)) : null;
    const onTrack = requiredMonthly === null ? null : summary.current.net >= requiredMonthly;
    return {
      id: goal._id,
      name: goal.name,
      targetAmount: round2(goal.targetAmount),
      currentAmount: round2(goal.currentAmount),
      remaining,
      progress,
      targetDate: goal.targetDate,
      color: goal.color,
      icon: goal.icon,
      isPrimary: goal.isPrimary,
      note: goal.note,
      monthsLeft,
      requiredMonthly,
      onTrack,
      projectedMonthly: monthlyContribution,
      milestones: goal.milestones,
    };
  });
}

/** Human sentences derived from real comparisons (never invented). */
function buildNarratives({ summary, currency, topCategory, topCategoryChange, budgets, goals, spendingIncreases }) {
  const lines = [];
  const m = summary.current;
  const prev = summary.previous;

  if (m.transactionCount === 0) {
    lines.push({
      tone: 'neutral',
      text: `No transactions logged for ${shortMonthLabel(m.month)} yet. Add your first entry to unlock insights.`,
      cta: { label: 'Add transaction', href: '/add-transaction' },
    });
  } else {
    // Mid-month we compare the same date window of the previous month, so the
    // sentence stays honest ("…by the 23rd" rather than "…than all of August").
    const partial = m.isPartialMonth && summary.current.mtdExpense != null;
    const baselineExpense = partial ? summary.current.mtdExpense : prev.expense;
    if (prev.transactionCount || partial) {
      const diff = round2(m.expense - baselineExpense);
      const change = partial ? summary.current.mtdExpenseChange : summary.current.expenseChange;
      const suffix = partial ? `by day ${m.daysElapsed} of ${shortMonthLabel(prev.month)}` : `than all of ${shortMonthLabel(prev.month)}`;
      lines.push({
        tone: diff > 0 ? 'warning' : diff < 0 ? 'success' : 'neutral',
        text:
          diff === 0
            ? `You have spent exactly the same as ${suffix} (${currency}${m.expense.toFixed(2)}).`
            : `You have spent ${currency}${Math.abs(diff).toFixed(2)} ${diff > 0 ? 'more' : 'less'} than last month ${suffix} (${Math.abs(Math.round(change || 0))}%).`,
      });
    }
    if (topCategory && Math.abs(topCategoryChange) >= 5) {
      lines.push({
        tone: topCategoryChange > 0 ? 'warning' : 'success',
        text: `${topCategory.name} spending ${topCategoryChange > 0 ? 'increased' : 'decreased'} ${Math.abs(Math.round(topCategoryChange))}% versus ${shortMonthLabel(prev.month)}.`,
      });
    }
    if (m.income > 0) {
      lines.push({
        tone: m.net >= 0 ? 'success' : 'danger',
        text:
          m.net >= 0
            ? `You are saving ${m.savingsRate}% of your income this month (${currency}${m.net.toFixed(2)} so far).`
            : `You are ${currency}${Math.abs(m.net).toFixed(2)} over your income for ${shortMonthLabel(m.month)}.`,
      });
    }
  }

  if (budgets.summary.overCount) {
    lines.push({
      tone: 'danger',
      text: `${budgets.summary.overCount} budget${budgets.summary.overCount > 1 ? 's are' : ' is'} over the limit.`,
      cta: { label: 'Review budgets', href: '/budgets' },
    });
  } else if (budgets.summary.nearCount) {
    lines.push({
      tone: 'warning',
      text: `${budgets.summary.nearCount} budget${budgets.summary.nearCount > 1 ? 's are' : ' is'} close to the limit.`,
      cta: { label: 'Review budgets', href: '/budgets' },
    });
  }

  if (spendingIncreases.length) {
    const biggest = spendingIncreases[0];
    lines.push({
      tone: 'warning',
      text: `${biggest.categoryName} is ${Math.round(biggest.changePercent)}% above your 3-month average (+${currency}${biggest.delta.toFixed(2)}).`,
      cta: { label: 'See tips', href: '/insights' },
    });
  }

  if (goals.length) {
    const goal = goals[0];
    const progress = percentOf(goal.currentAmount, goal.targetAmount);
    lines.push({
      tone: 'info',
      text: `"${goal.name}" is ${progress}% funded — ${currency}${Math.max(0, goal.targetAmount - goal.currentAmount).toFixed(2)} to go.`,
      cta: { label: 'Open goals', href: '/goals' },
    });
  }

  return lines;
}

/** First-time checklist state (also drives the onboarding card). */
async function buildChecklist(user) {
  const [txCount, budgetCount, goalCount, categoryCount] = await Promise.all([
    Transaction.countDocuments({ user: user._id }),
    Budget.countDocuments({ user: user._id }),
    SavingsGoal.countDocuments({ user: user._id }),
    Category.countDocuments({ user: user._id }),
  ]);
  return [
    { key: 'profile', label: 'Complete your profile', done: Boolean(user.academicYear && user.monthlyAllowance), href: '/profile' },
    { key: 'first_transaction', label: 'Log your first transaction', done: txCount > 0, href: '/add-transaction' },
    { key: 'budget', label: 'Create a category budget', done: budgetCount > 0, href: '/budgets' },
    { key: 'goal', label: 'Set a savings goal', done: goalCount > 0, href: '/goals' },
    { key: 'categories', label: 'Review your categories', done: categoryCount > 0, href: '/categories' },
  ];
}

module.exports = { getDashboard, buildChecklist, serialiseTip, serialiseInsight };
