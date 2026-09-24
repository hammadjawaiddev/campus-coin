const Insight = require('../models/Insight');
const analytics = require('./analyticsService');
const aiService = require('./aiService');
const tipsEngine = require('./tipsEngine');
const { startOfMonthUTC, monthKey, shortMonthLabel, lastMonths } = require('../utils/date');
const { round2, percentChange } = require('../utils/number');
const { logger } = require('../utils/logger');

/**
 * Monthly AI insight generation.
 *
 * The analytics layer ALWAYS computes the facts (totals, top category, biggest
 * movers). If an AI key is configured the narrative is written by the model on
 * top of those facts; otherwise a deterministic analytics-written narrative is
 * produced. Either way the numbers are real and the UI labels the source.
 */

async function collectFacts(userId, month, currency = '$') {
  const monthStart = startOfMonthUTC(month);
  const [current, previous, averages] = await Promise.all([
    analytics.monthlyBreakdown(userId, monthStart),
    analytics.monthlyBreakdown(userId, new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1))),
    analytics.categoryAverages(userId, 3, monthStart),
  ]);

  const avgByName = new Map(averages.map((a) => [a.name, a]));
  const movements = current.expenseByCategory
    .map((cat) => {
      const avg = avgByName.get(cat.name);
      const change = avg?.monthlyAverage ? percentChange(cat.total, avg.monthlyAverage) : percentChange(cat.total, previous.expenseByCategory.find((p) => p.name === cat.name)?.total || 0);
      return { name: cat.name, total: cat.total, average: avg?.monthlyAverage || 0, change, delta: round2(cat.total - (avg?.monthlyAverage || 0)) };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    month: monthStart,
    monthLabel: shortMonthLabel(monthStart),
    currency,
    current,
    previous,
    movements,
    metrics: {
      totalIncome: current.income,
      totalExpense: current.expense,
      netSavings: current.net,
      savingsRate: current.savingsRate,
      transactionCount: current.transactionCount,
      topCategory: current.topCategory?.name || 'None',
      biggestChange: movements[0] ? `${movements[0].name} ${movements[0].change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(movements[0].change))}%` : 'Not enough history',
    },
  };
}

/** Deterministic narrative used when AI is unavailable — never empty. */
function analyticsNarrative(facts) {
  const { current, previous, movements, currency } = facts;
  const highlights = [];
  const tips = [];

  if (!current.transactionCount) {
    return {
      summary:
        `There are no transactions logged for ${facts.monthLabel} yet. Log a few expenses and your personalised summary will appear here — it usually takes 5-8 entries to spot a pattern.`,
      tips: ['Log your daily food and transport spend for a week to unlock category comparisons.', 'Add a monthly allowance entry so savings rate can be calculated.'],
      highlights: ['No activity recorded yet'],
    };
  }

  const parts = [];
  parts.push(`In ${facts.monthLabel} you logged ${current.transactionCount} transactions: ${currency}${current.income.toFixed(2)} in and ${currency}${current.expense.toFixed(2)} out.`);

  if (current.income > 0) {
    parts.push(
      current.net >= 0
        ? `That leaves ${currency}${current.net.toFixed(2)} unspent — a savings rate of ${current.savingsRate}%.`
        : `You spent ${currency}${Math.abs(current.net).toFixed(2)} more than came in, a deficit of ${Math.abs(current.savingsRate)}% of income.`,
    );
  }

  if (movements.length) {
    const biggest = movements[0];
    parts.push(
      `Biggest movement: ${biggest.name} ${biggest.change >= 0 ? 'rose' : 'fell'} ${Math.abs(Math.round(biggest.change))}% versus your recent average` +
        (biggest.average ? ` (${currency}${biggest.total.toFixed(2)} vs ${currency}${biggest.average.toFixed(2)})` : '') +
        '.',
    );
    highlights.push(`${biggest.name}: ${biggest.change >= 0 ? '+' : ''}${Math.round(biggest.change)}% vs your average`);
    if (biggest.change > 20) {
      tips.push(`Set a cap of ${currency}${Math.max(1, Math.round(biggest.average * 0.9))} on ${biggest.name} next month to pull it back to your normal level.`);
    } else if (biggest.change < -15) {
      tips.push(`Nice — ${biggest.name} is down ${Math.abs(Math.round(biggest.change))}%. Consider moving the difference into your savings goal.`);
    }
  }

  if (current.topCategory) {
    highlights.push(`Top category: ${current.topCategory.name} (${currency}${current.topCategory.total.toFixed(2)}, ${current.topCategory.share}% of spending)`);
    tips.push(`${current.topCategory.name} is ${current.topCategory.share}% of your spending. Try trimming it by 10% — that frees ${currency}${(current.topCategory.total * 0.1).toFixed(2)} this month.`);
  }

  if (previous.transactionCount && current.expense) {
    const change = percentChange(current.expense, previous.expense);
    highlights.push(`Total spending ${change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(change))}% vs ${shortMonthLabel(previous.month)}`);
    if (Math.abs(change) > 25) {
      tips.push(
        change > 0
          ? `Spending jumped ${Math.round(change)}% month over month. Check the transactions above ${currency}${(current.averageExpense * 2).toFixed(2)} to see what caused it.`
          : `Spending dropped ${Math.abs(Math.round(change))}% month over month — keep the habit and update your savings goal upwards.`,
      );
    }
  }

  if (!tips.length) tips.push('Keep logging for another month to unlock category-level comparisons and tailored caps.');

  return { summary: parts.join(' '), tips: tips.slice(0, 4), highlights: highlights.slice(0, 3) };
}

/**
 * Generate (or regenerate) an insight for a month.
 * @param {string} userId
 * @param {Date|string} month
 * @param {{currency?:string, force?:boolean, useAi?:boolean}} options
 */
async function generateForMonth(userId, month = new Date(), { currency = '$', force = false, useAi = true } = {}) {
  const monthStart = startOfMonthUTC(month);
  const existing = await Insight.findOne({ user: userId, month: monthStart });

  // Always refresh the numbers; only skip if nothing changed and not forced.
  if (existing && !force && existing.metrics?.transactionCount === undefined) {
    return existing;
  }

  const facts = await collectFacts(userId, monthStart, currency);
  const fallback = analyticsNarrative(facts);

  let narrative = fallback;
  let source = 'analytics';
  let model = '';

  if (useAi) {
    const ai = await aiService.monthlyNarrative({
      monthLabel: facts.monthLabel,
      currency,
      metrics: facts.metrics,
      categoryLines: facts.current.expenseByCategory.slice(0, 6).map((c) => `- ${c.name}: ${currency}${c.total.toFixed(2)} (${c.share}% of spend, ${c.count} txns)`),
      comparisonLines: facts.movements.slice(0, 4).map((m) => `- ${m.name}: ${m.change >= 0 ? '+' : ''}${Math.round(m.change)}% vs 3-month average (${currency}${m.total.toFixed(2)})`),
    });
    if (ai.ok) {
      narrative = {
        summary: ai.summary,
        tips: ai.tips.length ? ai.tips : fallback.tips,
        highlights: ai.highlights.length ? ai.highlights : fallback.highlights,
      };
      source = 'ai';
      model = ai.model || '';
    }
  }

  const title = `${facts.monthLabel} recap: ${currency}${facts.metrics.totalExpense.toFixed(0)} spent, ${facts.metrics.savingsRate}% saved`;
  const tipText = narrative.tips?.[0] || '';

  const insight = await Insight.findOneAndUpdate(
    { user: userId, month: monthStart },
    {
      $set: {
        title,
        summaryText: narrative.summary,
        tipText,
        highlights: narrative.highlights || [],
        metrics: facts.metrics,
        source,
        model,
        status: 'active',
      },
      $setOnInsert: { user: userId, month: monthStart },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Store the remaining tips as saving tips so the student can pin/bookmark them.
  const generated = await tipsEngine.generate(userId, { month: monthStart, currency });
  logger.debug(`insight for ${monthKey(monthStart)} generated (source=${source}, tips=${generated.length})`);

  return insight;
}

/** Latest N months of insights, most recent first. */
const list = (userId, { limit = 12, includeDismissed = false } = {}) => {
  const query = { user: userId };
  if (!includeDismissed) query.status = 'active';
  return Insight.find(query).sort({ month: -1 }).limit(limit).lean();
};

const latest = (userId) => Insight.findOne({ user: userId, status: 'active' }).sort({ month: -1 }).lean();

const setStatus = (userId, id, status) => Insight.findOneAndUpdate({ _id: id, user: userId }, { $set: { status } }, { new: true });

const toggleBookmark = async (userId, id) => {
  const insight = await Insight.findOne({ _id: id, user: userId });
  if (!insight) return null;
  insight.bookmarked = !insight.bookmarked;
  if (!insight.readAt) insight.readAt = new Date();
  await insight.save();
  return insight;
};

/** Months that still need an insight (used by the dashboard auto-generate). */
async function missingMonths(userId, months = 3) {
  const keys = lastMonths(months);
  const existing = await Insight.find({ user: userId, month: { $in: keys } }).select('month metrics.transactionCount').lean();
  const have = new Map(existing.map((i) => [monthKey(i.month), i]));
  return keys.filter((k) => {
    const found = have.get(monthKey(k));
    return !found || !found.metrics?.transactionCount;
  });
}

module.exports = { generateForMonth, list, latest, setStatus, toggleBookmark, collectFacts, analyticsNarrative, missingMonths };
