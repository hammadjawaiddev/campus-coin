const Insight = require('../models/Insight');
const Bookmark = require('../models/Bookmark');
const SavingTip = require('../models/SavingTip');
const insightsService = require('../services/insightsService');
const tipsEngine = require('../services/tipsEngine');
const analytics = require('../services/analyticsService');
const activityService = require('../services/activityService');
const aiService = require('../services/aiService');
const { currencySymbol } = require('../services/transactionService');
const { ok, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { startOfMonthUTC, monthLabel } = require('../utils/date');

/** GET /api/insights?limit=12 */
const list = asyncHandler(async (req, res) => {
  const insights = await insightsService.list(req.user._id, { limit: Number(req.query.limit) || 12, includeDismissed: req.query.includeDismissed === 'true' });
  return ok(res, { insights, ai: aiService.status() }, 'Insights loaded');
});

/** GET /api/insights/latest */
const latest = asyncHandler(async (req, res) => {
  const insight = await insightsService.latest(req.user._id);
  return ok(res, { insight: insight || null, ai: aiService.status() }, insight ? 'Latest insight' : 'No insights yet');
});

/**
 * POST /api/insights/generate
 * Body: { month?: 'YYYY-MM', force?: boolean }
 */
const generate = asyncHandler(async (req, res) => {
  const month = startOfMonthUTC(req.body.month ? new Date(`${req.body.month}-01T00:00:00.000Z`) : new Date());
  const insight = await insightsService.generateForMonth(req.user._id, month, {
    currency: currencySymbol(req.user),
    force: req.body.force !== false,
    useAi: req.body.useAi !== false,
  });
  await activityService.logActivity({ user: req.user._id, action: 'ai', entity: 'insight', entityId: insight._id, label: `Generated insight (${insight.source})` });
  return created(
    res,
    { insight, ai: aiService.status() },
    insight.source === 'ai' ? 'AI insight generated' : 'Insight generated from your transaction analytics',
  );
});

/** PATCH /api/insights/:id — dismiss / restore */
const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'dismissed'].includes(status)) throw ApiError.badRequest('Invalid status');
  const insight = await insightsService.setStatus(req.user._id, req.params.id, status);
  if (!insight) throw ApiError.notFound('Insight not found');
  return ok(res, { insight }, status === 'dismissed' ? 'Insight dismissed' : 'Insight restored');
});

/** POST /api/insights/:id/bookmark */
const bookmark = asyncHandler(async (req, res) => {
  const insight = await insightsService.toggleBookmark(req.user._id, req.params.id);
  if (!insight) throw ApiError.notFound('Insight not found');

  if (insight.bookmarked) {
    await Bookmark.findOneAndUpdate(
      { user: req.user._id, itemType: 'insight', itemId: insight._id },
      {
        $set: { title: insight.title, body: insight.summaryText, meta: { month: insight.month, source: insight.source, metrics: insight.metrics } },
        $setOnInsert: { user: req.user._id, itemType: 'insight', itemId: insight._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } else {
    await Bookmark.deleteOne({ user: req.user._id, itemType: 'insight', itemId: insight._id });
  }

  return ok(res, { insight }, insight.bookmarked ? 'Insight bookmarked' : 'Bookmark removed');
});

/** GET /api/tips */
const listTips = asyncHandler(async (req, res) => {
  const month = startOfMonthUTC(req.query.month ? new Date(`${req.query.month}-01T00:00:00.000Z`) : new Date());
  const includeDismissed = req.query.includeDismissed === 'true';
  let tips = await tipsEngine.list(req.user._id, { month, includeDismissed, limit: 20 });
  if (!tips.length) tips = await tipsEngine.generate(req.user._id, { month, currency: currencySymbol(req.user), limit: 8 });
  return ok(res, { tips, month, monthLabel: monthLabel(month) }, 'Saving tips loaded');
});

/** POST /api/tips/generate */
const generateTips = asyncHandler(async (req, res) => {
  const month = startOfMonthUTC(req.body.month ? new Date(`${req.body.month}-01T00:00:00.000Z`) : new Date());
  const tips = await tipsEngine.generate(req.user._id, { month, currency: currencySymbol(req.user), limit: Number(req.body.limit) || 8 });
  return created(res, { tips }, `${tips.length} tips generated from your transaction history`);
});

/** POST /api/tips/:id/pin | /dismiss | /bookmark */
const updateTip = asyncHandler(async (req, res) => {
  const { action } = req.params;
  let tip;
  if (action === 'pin') tip = await tipsEngine.setFlag(req.user._id, req.params.id, { pinned: Boolean(req.body.value) });
  else if (action === 'dismiss') tip = await tipsEngine.setFlag(req.user._id, req.params.id, { dismissed: true, seenAt: new Date() });
  else if (action === 'restore') tip = await tipsEngine.setFlag(req.user._id, req.params.id, { dismissed: false });
  else if (action === 'bookmark') {
    tip = await tipsEngine.toggleBookmark(req.user._id, req.params.id);
    if (tip?.bookmarked) {
      await Bookmark.findOneAndUpdate(
        { user: req.user._id, itemType: 'tip', itemId: tip._id },
        { $set: { title: tip.title, body: tip.body, meta: { severity: tip.severity, potentialSaving: tip.potentialSaving, categoryName: tip.categoryName } }, $setOnInsert: { user: req.user._id, itemType: 'tip', itemId: tip._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } else if (tip) {
      await Bookmark.deleteOne({ user: req.user._id, itemType: 'tip', itemId: tip._id });
    }
  } else {
    throw ApiError.badRequest('Unsupported tip action');
  }

  if (!tip) throw ApiError.notFound('Tip not found');
  return ok(res, { tip }, 'Tip updated');
});

/** GET /api/tips/weekly-cap/:categoryName — concrete cap suggestion for a category. */
const weeklyCap = asyncHandler(async (req, res) => {
  const suggestion = await tipsEngine.weeklyCapSuggestion(
    req.user._id, req.params.categoryName, new Date(), currencySymbol(req.user),
  );
  if (!suggestion) throw ApiError.notFound(`No spending recorded for "${req.params.categoryName}" this month yet`);
  return ok(res, suggestion, suggestion.text);
});

/** GET /api/insights/recommendations — combined intelligence feed for the insights page. */
const recommendations = asyncHandler(async (req, res) => {
  const [summary, tips, insight, budgetInsights] = await Promise.all([
    analytics.summaryWithComparisons(req.user._id, new Date(), currencySymbol(req.user)),
    tipsEngine.list(req.user._id, { limit: 8 }),
    insightsService.latest(req.user._id),
    analytics.budgetPerformance(req.user._id, startOfMonthUTC(new Date()), currencySymbol(req.user)),
  ]);

  const potential = tips.reduce((s, t) => s + (t.potentialSaving || 0), 0);

  return ok(
    res,
    {
      insight,
      tips,
      potentialMonthlySaving: Math.round(potential * 100) / 100,
      currency: currencySymbol(req.user),
      budgetHealth: budgetInsights.summary,
      savingsRate: summary.current.savingsRate,
      ai: aiService.status(),
      disclaimer:
        'Insights and tips are automated suggestions generated from your own logged transactions. They are not professional financial advice.',
    },
    'Recommendations ready',
  );
});

/** GET /api/insights/accuracy — how often the student accepts suggestions. */
const accuracy = asyncHandler(async (req, res) => {
  const categorizationService = require('../services/categorizationService');
  const since = new Date(Date.now() - 90 * 86400000);
  const [stats, corrections] = await Promise.all([
    categorizationService.accuracyStats({ since }),
    Bookmark.countDocuments({ user: req.user._id }),
  ]);
  return ok(res, { categorization: stats, bookmarks: corrections }, 'Intelligence accuracy');
});

module.exports = { list, latest, generate, setStatus, bookmark, listTips, generateTips, updateTip, weeklyCap, recommendations, accuracy };
