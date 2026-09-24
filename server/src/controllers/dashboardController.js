const dashboardService = require('../services/dashboardService');
const analytics = require('../services/analyticsService');
const detection = require('../services/detectionService');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { startOfMonthUTC } = require('../utils/date');
const { currencySymbol } = require('../services/transactionService');

/** GET /api/dashboard?month=YYYY-MM&refresh=true */
const get = asyncHandler(async (req, res) => {
  const month = startOfMonthUTC(req.query.month ? new Date(`${req.query.month}-01T00:00:00.000Z`) : new Date());
  const data = await dashboardService.getDashboard(req.user, { month, refresh: req.query.refresh === 'true' });
  return ok(res, data, 'Dashboard loaded');
});

/** GET /api/dashboard/checklist — first-run progress. */
const checklist = asyncHandler(async (req, res) => {
  const [items, serviceStatus] = await Promise.all([
    dashboardService.buildChecklist(req.user),
    Promise.resolve({ ai: aiService.status(), email: emailService.status() }),
  ]);
  const completed = items.filter((i) => i.done).length;
  return ok(
    res,
    {
      items,
      completed,
      total: items.length,
      percent: Math.round((completed / items.length) * 100),
      dismissed: req.user.onboarding?.dismissedChecklist || false,
      services: serviceStatus,
    },
    'Checklist loaded',
  );
});

/** GET /api/dashboard/forecast — next-month projection. */
const forecast = asyncHandler(async (req, res) => {
  const [forecastData, increases] = await Promise.all([
    detection.forecastNextMonth(req.user._id),
    detection.checkSpendingIncrease(req.user._id, { threshold: 20 }),
  ]);
  return ok(res, { forecast: forecastData, acceleratingCategories: increases, currency: currencySymbol(req.user) }, 'Forecast ready');
});

/** GET /api/dashboard/compare?months=6 — month-by-month comparison table. */
const compare = asyncHandler(async (req, res) => {
  const months = Math.min(12, Math.max(2, Number(req.query.months) || 6));
  const summary = await analytics.summaryWithComparisons(req.user._id, new Date(), currencySymbol(req.user));
  const trend = await analytics.monthlyTrend(req.user._id, months);

  const rows = trend.map((t, i) => {
    const prev = i > 0 ? trend[i - 1] : null;
    return {
      ...t,
      expenseChange: prev ? (prev.expense ? Math.round(((t.expense - prev.expense) / prev.expense) * 10000) / 100 : null) : null,
      incomeChange: prev ? (prev.income ? Math.round(((t.income - prev.income) / prev.income) * 10000) / 100 : null) : null,
    };
  });

  return ok(res, { rows, current: summary.current, previous: summary.previous, currency: currencySymbol(req.user) }, 'Comparison loaded');
});

module.exports = { get, checklist, forecast, compare };
