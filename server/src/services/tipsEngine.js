const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const SavingTip = require('../models/SavingTip');
const Category = require('../models/Category');
const analytics = require('./analyticsService');
const { CATEGORY_PLAYBOOK } = require('../config/constants');
const { startOfMonthUTC, monthKey, shortMonthLabel } = require('../utils/date');
const { round2, percentChange, percentOf, safeDivide } = require('../utils/number');
const { logger } = require('../utils/logger');

/**
 * Rule-based personalised saving tips engine.
 *
 * It compares the current month's real transactions against:
 *   • the student's own 3-month average per category,
 *   • their budget limits for the month,
 *   • their savings goal and remaining time,
 *   • campus-specific heuristics (delivery orders, subscription creep, ...).
 *
 * Each tip carries an estimated monthly saving so tips can be ranked by impact.
 * Tips are persisted per month with a deterministic `key`, so re-running the
 * engine refreshes content without losing pinned/dismissed state.
 */

const money = (amount, currency = '$') => `${currency}${round2(amount).toFixed(2)}`;

async function gatherContext(userId, month = new Date(), currency = '$') {
  const monthStart = startOfMonthUTC(month);
  const [current, averages, budgets, goal, deliveryStats, subscriptionItems, weekendStats] = await Promise.all([
    analytics.monthlyBreakdown(userId, monthStart),
    analytics.categoryAverages(userId, 3, monthStart),
    Budget.find({ user: userId, month: monthStart }).populate('category', 'name color icon').lean(),
    SavingsGoal.findOne({ user: userId, status: 'active' }).sort({ isPrimary: -1, createdAt: 1 }).lean(),
    Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: monthStart },
      description: { $regex: /delivery|foodpanda|zomato|swiggy|ubereats|order/i },
    }).select('amount').lean(),
    Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: monthStart },
      $or: [{ recurring: true }, { description: { $regex: /netflix|spotify|subscription|prime|icloud|youtube|adobe|canva|chatgpt/i } }],
    }).populate('category', 'name').select('amount description category').lean(),
    Transaction.aggregate([
      { $match: { user: userId, type: 'expense', date: { $gte: monthStart } } },
      {
        $group: {
          _id: { $cond: [{ $in: [{ $dayOfWeek: '$date' }, [1, 7]] }, 'weekend', 'weekday'] },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const budgetMap = new Map(budgets.filter((b) => b.category).map((b) => [String(b.category._id), b]));

  return { monthStart, current, averages, budgets, budgetMap, goal, deliveryStats, subscriptionItems, weekendStats, currency };
}

/** Build the ranked candidate list of tips (pure function → easy to test). */
function buildTipCandidates(ctx) {
  const tips = [];
  const { current, averages, budgetMap, goal, deliveryStats, subscriptionItems, weekendStats, currency } = ctx;
  const totalExpense = current.expense || 0;
  const avgByCategory = new Map(averages.map((a) => [a.name, a]));

  // ── 1. Category spikes vs the student's own 3-month average ──────────────
  current.expenseByCategory.forEach((cat) => {
    const avg = avgByCategory.get(cat.name);
    if (!avg || avg.monthlyAverage < 1) return;
    const change = percentChange(cat.total, avg.monthlyAverage);
    const overspend = round2(cat.total - avg.monthlyAverage);
    if (change <= 15 || overspend < 3) return;

    const playbook = CATEGORY_PLAYBOOK[cat.name];
    tips.push({
      key: `spike:${cat.name}`,
      title: `${cat.name} is up ${Math.round(change)}% this month`,
      body: `You have spent ${money(cat.total, currency)} on ${cat.name} versus your usual ${money(avg.monthlyAverage, currency)}. ${playbook?.tip || 'Trimming this category by a quarter would bring you back to your normal level.'}`,
      actionLabel: 'Set a budget',
      actionHref: '/budgets',
      categoryId: cat.categoryId,
      categoryName: cat.name,
      severity: change > 40 ? 'danger' : 'warning',
      potentialSaving: round2(overspend * 0.5),
    });
  });

  // ── 2. Budgets that are nearly or fully consumed ─────────────────────────
  budgetMap.forEach((budget, categoryId) => {
    const spendRow = current.expenseByCategory.find((c) => String(c.categoryId) === String(categoryId));
    const spent = spendRow?.total || 0;
    const used = percentOf(spent, budget.limitAmount);
    if (used >= 100) {
      tips.push({
        key: `budget-over:${budget.category?.name || categoryId}`,
        title: `${budget.category?.name} budget exceeded`,
        body: `You are ${money(spent - budget.limitAmount, currency)} over your ${money(budget.limitAmount, currency)} cap with ${Math.max(0, 30 - new Date().getUTCDate())} days left in the month. Pause this category for a week or shift money from a category you barely use.`,
        actionLabel: 'Review budgets',
        actionHref: '/budgets',
        categoryId,
        categoryName: budget.category?.name,
        severity: 'danger',
        potentialSaving: round2((spent - budget.limitAmount) * 0.6),
      });
    } else if (used >= (budget.alertThreshold || 80)) {
      tips.push({
        key: `budget-near:${budget.category?.name || categoryId}`,
        title: `You are at ${Math.round(used)}% of your ${budget.category?.name} budget`,
        body: `Only ${money(Math.max(0, budget.limitAmount - spent), currency)} remains. Slowing down now still keeps the category inside its limit this month.`,
        actionLabel: 'View budget',
        actionHref: '/budgets',
        categoryId,
        categoryName: budget.category?.name,
        severity: 'warning',
        potentialSaving: round2(Math.max(0, budget.limitAmount - spent) * 0.25),
      });
    }
  });

  // ── 3. Food delivery habit ───────────────────────────────────────────────
  const deliveryTotal = round2(deliveryStats.reduce((s, t) => s + t.amount, 0));
  if (deliveryStats.length >= 3 && deliveryTotal >= 8) {
    const perOrder = safeDivide(deliveryTotal, deliveryStats.length);
    tips.push({
      key: 'food-delivery',
      title: `Cut 2 delivery orders this week`,
      body: `${deliveryStats.length} delivery orders (${money(deliveryTotal, currency)}) this month — about ${money(perOrder, currency)} each. Swapping two of them for the mess or a home-cooked meal saves roughly ${money(perOrder * 2, currency)} a week.`,
      actionLabel: 'Log a transaction',
      actionHref: '/add-transaction',
      categoryName: 'Food',
      severity: 'info',
      potentialSaving: round2(perOrder * 2 * 4),
    });
  }

  // ── 4. Subscription creep ────────────────────────────────────────────────
  const subscriptionTotal = round2(subscriptionItems.reduce((s, t) => s + t.amount, 0));
  if (subscriptionItems.length >= 2 || subscriptionTotal > 0) {
    const unique = new Set(subscriptionItems.map((t) => (t.description || '').toLowerCase().split(' ')[0])).size;
    tips.push({
      key: 'subscriptions-audit',
      title: 'Audit your subscriptions',
      body: `${money(subscriptionTotal, currency)} went to subscriptions/recurring charges this month${unique > 1 ? ` across ${unique} services` : ''}. Streaming and app plans are the easiest wins — cancel one unused plan and redirect it to your savings goal.`,
      actionLabel: 'See subscriptions',
      actionHref: '/transactions?category=Subscriptions',
      categoryName: 'Subscriptions',
      severity: 'info',
      potentialSaving: round2(subscriptionTotal * 0.3),
    });
  }

  // ── 5. Savings goal pace ─────────────────────────────────────────────────
  if (goal) {
    const remaining = Math.max(0, round2(goal.targetAmount - goal.currentAmount));
    const daysLeft = goal.targetDate ? Math.ceil((new Date(goal.targetDate) - new Date()) / 86400000) : null;
    const monthsLeft = daysLeft ? Math.max(1, Math.round(daysLeft / 30)) : null;
    const perMonthNeeded = monthsLeft ? round2(remaining / monthsLeft) : null;
    const savedThisMonth = round2(current.net);
    if (remaining > 0) {
      tips.push({
        key: 'goal-pace',
        title: perMonthNeeded ? `Save ${money(perMonthNeeded, currency)}/month to hit "${goal.name}"` : `Grow "${goal.name}" by ${money(Math.max(25, remaining * 0.1), currency)}`,
        body: perMonthNeeded
          ? `With ${monthsLeft} month${monthsLeft === 1 ? '' : 's'} until your target date you need ${money(perMonthNeeded, currency)} per month. This month you are ${savedThisMonth >= perMonthNeeded ? 'on track 🎉' : `short by ${money(perMonthNeeded - savedThisMonth, currency)}`}.`
          : `You are ${money(remaining, currency)} away from your goal. Adding ${money(Math.max(10, round2(remaining * 0.1)), currency)} this week keeps the streak alive.`,
        actionLabel: 'Open goals',
        actionHref: '/goals',
        severity: savedThisMonth >= (perMonthNeeded || 0) ? 'success' : 'info',
        potentialSaving: perMonthNeeded || 0,
      });
    }
  } else {
    tips.push({
      key: 'goal-missing',
      title: 'Create your first savings goal',
      body: 'Students who set an explicit target save markedly more than those who "save whatever is left". Even a small laptop or trip fund works as a starting target.',
      actionLabel: 'Set a goal',
      actionHref: '/goals',
      severity: 'info',
      potentialSaving: 0,
    });
  }

  // ── 6. Category concentration (no budget yet) ───────────────────────────
  const topUnbudgeted = current.expenseByCategory.find((c) => !budgetMap.has(String(c.categoryId)));
  if (topUnbudgeted && percentOf(topUnbudgeted.total, totalExpense) >= 25 && !tips.some((t) => t.key.includes(topUnbudgeted.name))) {
    tips.push({
      key: `unbudgeted:${topUnbudgeted.name}`,
      title: `${Math.round(percentOf(topUnbudgeted.total, totalExpense))}% of your spending has no budget`,
      body: `${topUnbudgeted.name} is your biggest unbudgeted category (${money(topUnbudgeted.total, currency)} this month). A soft cap of ${money(topUnbudgeted.total * 0.85, currency)} gives you a target without feeling restrictive.`,
      actionLabel: 'Create budget',
      actionHref: '/budgets',
      categoryId: topUnbudgeted.categoryId,
      categoryName: topUnbudgeted.name,
      severity: 'info',
      potentialSaving: round2(topUnbudgeted.total * 0.15),
    });
  }

  // ── 7. Weekend overspending pattern ─────────────────────────────────────
  const weekend = weekendStats.find((s) => s._id === 'weekend');
  const weekday = weekendStats.find((s) => s._id === 'weekday');
  if (weekend && weekday) {
    const weekendPerDay = safeDivide(weekend.total, 2.5);
    const weekdayPerDay = safeDivide(weekday.total, 5);
    if (weekendPerDay > weekdayPerDay * 1.5 && weekend.total > 10) {
      tips.push({
        key: 'weekend-pattern',
        title: 'Your weekends cost more than your week',
        body: `Weekend days average ${money(weekendPerDay, currency)} versus ${money(weekdayPerDay, currency)} on weekdays. Try a fixed weekend fun budget — students who do this typically shave 10-20% off entertainment.`,
        actionLabel: 'Set entertainment cap',
        actionHref: '/budgets',
        categoryName: 'Entertainment',
        severity: 'info',
        potentialSaving: round2((weekendPerDay - weekdayPerDay) * 2),
      });
    }
  }

  // ── 8. Savings-rate awareness ───────────────────────────────────────────
  if (totalExpense > 0 && current.income > 0) {
    const rate = round2(current.savingsRate);
    if (rate < 10) {
      tips.push({
        key: 'low-savings-rate',
        title: `You are saving ${rate}% of what came in`,
        body: `Aiming for even 15% builds a semester buffer for emergencies. Automate it: move ${money(current.income * 0.15, currency)} to savings the day your allowance arrives, before it gets spent.`,
        actionLabel: 'Adjust goal',
        actionHref: '/goals',
        severity: rate < 0 ? 'danger' : 'warning',
        potentialSaving: round2(Math.max(0, current.income * 0.15 - current.net)),
      });
    } else if (rate >= 25) {
      tips.push({
        key: 'strong-savings-rate',
        title: `Strong month — ${rate}% saved 🎉`,
        body: `You kept ${money(current.net, currency)} of ${money(current.income, currency)} this month. Consider moving part of it into a locked goal so it is not spent by accident.`,
        actionLabel: 'Open goals',
        actionHref: '/goals',
        severity: 'success',
        potentialSaving: 0,
      });
    }
  }

  return tips
    .map((tip) => ({
      ...tip,
      // Impact ranking: money saved per month dominates, severity breaks ties.
      impactScore: round2(
        Math.min(100, tip.potentialSaving * 0.6 + (tip.severity === 'danger' ? 30 : tip.severity === 'warning' ? 20 : tip.severity === 'success' ? 8 : 12)),
      ),
    }))
    .sort((a, b) => b.impactScore - a.impactScore);
}

/** Generate (or refresh) and persist this month's tips. */
async function generate(userId, { month = new Date(), currency = '$', limit = 8 } = {}) {
  const ctx = await gatherContext(userId, month, currency);
  const candidates = buildTipCandidates(ctx).slice(0, limit);
  const monthStart = ctx.monthStart;

  const saved = await Promise.all(
    candidates.map((tip) =>
      SavingTip.findOneAndUpdate(
        { user: userId, month: monthStart, key: tip.key },
        {
          $set: {
            title: tip.title,
            body: tip.body,
            actionLabel: tip.actionLabel,
            actionHref: tip.actionHref,
            category: tip.categoryId || null,
            categoryName: tip.categoryName || '',
            severity: tip.severity,
            potentialSaving: tip.potentialSaving,
            impactScore: tip.impactScore,
          },
          $setOnInsert: { user: userId, month: monthStart, key: tip.key },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  logger.debug(`tips engine: ${saved.length} tips for ${monthKey(monthStart)}`);
  return saved;
}

/** List tips for a month, newest impact first, respecting dismissals. */
async function list(userId, { month = new Date(), includeDismissed = false, limit = 20 } = {}) {
  const query = { user: userId, month: startOfMonthUTC(month) };
  if (!includeDismissed) query.dismissed = false;
  return SavingTip.find(query).sort({ pinned: -1, impactScore: -1 }).limit(limit).lean();
}

const setFlag = (userId, id, patch) =>
  SavingTip.findOneAndUpdate({ _id: id, user: userId }, { $set: patch }, { new: true });

const toggleBookmark = async (userId, id) => {
  const tip = await SavingTip.findOne({ _id: id, user: userId });
  if (!tip) return null;
  tip.bookmarked = !tip.bookmarked;
  await tip.save();
  return tip;
};

/** A concrete, actionable weekly cap suggestion (used by the insights page). */
async function weeklyCapSuggestion(userId, categoryName, month = new Date(), currency = '$') {
  const monthStart = startOfMonthUTC(month);
  const category = await Category.findOne({ user: userId, name: categoryName, type: 'expense' }).lean();
  if (!category) return null;
  const rows = await Transaction.aggregate([
    { $match: { user: userId, category: category._id, type: 'expense', date: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const spent = round2(rows[0]?.total || 0);
  if (!spent) return null;
  const dayOfMonth = new Date().getUTCDate();
  const dailyRate = safeDivide(spent, dayOfMonth);
  return {
    categoryName,
    spent,
    suggestedWeeklyCap: round2(dailyRate * 7 * 0.85),
    suggestedMonthlyCap: round2(dailyRate * 30 * 0.85),
    text: `Cap ${categoryName} at ${money(dailyRate * 7 * 0.85, currency)} per week (about 15% below your current pace).`,
  };
}

module.exports = {
  generate,
  list,
  setFlag,
  toggleBookmark,
  weeklyCapSuggestion,
  buildTipCandidates,
  gatherContext,
  monthLabel: shortMonthLabel,
};
