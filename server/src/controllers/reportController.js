const reportsService = require('../services/reportsService');
const activityService = require('../services/activityService');
const { ok, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { currencySymbol } = require('../services/transactionService');

/**
 * GET /api/reports?from=&to=&month=&category=&type=
 * Returns everything the reports page renders: overview, category breakdown,
 * 6-month trend, daily/weekly summaries and budget performance.
 */
const get = asyncHandler(async (req, res) => {
  const report = await reportsService.build(req.user, {
    from: req.query.from,
    to: req.query.to,
    month: req.query.month,
    categoryId: req.query.category,
    type: req.query.type,
    currency: currencySymbol(req.user),
  });
  const movers = await reportsService.highlightMovers(req.user, report.range.to);
  await activityService.logActivity({ user: req.user._id, action: 'view', entity: 'report', label: `Viewed report ${report.range.label}` });
  return ok(res, { ...report, movers }, 'Report generated from your transaction history');
});

/**
 * GET /api/reports/export.csv
 * Real CSV export generated from the same aggregation pipeline (opens natively
 * in Excel / Sheets and is what the PDF export embeds as its data table).
 */
const exportCsv = asyncHandler(async (req, res) => {
  const report = await reportsService.build(req.user, {
    from: req.query.from,
    to: req.query.to,
    month: req.query.month,
    categoryId: req.query.category,
    type: req.query.type,
    currency: currencySymbol(req.user),
  });

  const escape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [];
  lines.push(`Campus Coin report,${report.range.label}`);
  lines.push(`Student,${req.user.name} (${req.user.email})`);
  lines.push(`Generated,${new Date().toISOString()}`);
  lines.push('');
  lines.push('Overview');
  lines.push(['Metric', 'Value'].join(','));
  lines.push(['Income', report.overview.income].join(','));
  lines.push(['Expenses', report.overview.expense].join(','));
  lines.push(['Net saved', report.overview.net].join(','));
  lines.push(['Savings rate (%)', report.overview.savingsRate].join(','));
  lines.push(['Transactions', report.overview.transactionCount].join(','));
  lines.push(['Average transaction', report.overview.averageTransaction].join(','));
  lines.push('');
  lines.push('Expenses by category');
  lines.push(['Category', 'Total', 'Transactions', 'Share %'].join(','));
  const totalExpense = report.byCategory.expense.reduce((s, c) => s + c.total, 0) || 1;
  report.byCategory.expense.forEach((c) => {
    lines.push([escape(c.name), c.total, c.count, ((c.total / totalExpense) * 100).toFixed(1)].join(','));
  });
  lines.push('');
  lines.push('Income by category');
  lines.push(['Category', 'Total', 'Transactions'].join(','));
  report.byCategory.income.forEach((c) => lines.push([escape(c.name), c.total, c.count].join(',')));
  lines.push('');
  lines.push('Monthly trend (6 months)');
  lines.push(['Month', 'Income', 'Expenses', 'Net'].join(','));
  report.byMonth.forEach((m) => lines.push([m.label, m.income, m.expense, m.net].join(',')));
  lines.push('');
  lines.push('Daily spending (selected range)');
  lines.push(['Date', 'Income', 'Expenses', 'Transactions'].join(','));
  report.daily.forEach((d) => lines.push([d.date, d.income, d.expense, d.count].join(',')));
  lines.push('');
  lines.push('Budget performance');
  lines.push(['Category', 'Limit', 'Spent', 'Remaining', 'Status'].join(','));
  report.budgets.rows.forEach((b) => lines.push([escape(b.categoryName), b.limit, b.spent, b.remaining, b.status].join(',')));

  const csv = `${lines.join('\n')}\n`;
  const filename = `campus-coin-report-${report.range.from.toISOString().slice(0, 10)}-to-${report.range.to.toISOString().slice(0, 10)}.csv`;

  await activityService.logActivity({ user: req.user._id, action: 'export', entity: 'report', label: `CSV export ${report.range.label}` });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

/** POST /api/reports/save — bookmark a report summary for later. */
const save = asyncHandler(async (req, res) => {
  const { note = '', rangeLabel = '', overview = {}, filters = {} } = req.body;
  const bookmark = await reportsService.saveSummary(req.user, { note, rangeLabel, overview, filters });
  return created(res, { bookmark }, 'Report summary saved to bookmarks');
});

module.exports = { get, exportCsv, save };
