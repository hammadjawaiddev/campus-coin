import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, BarChart3, Bookmark, CalendarRange, Download, FileSpreadsheet, FileText,
  Filter, Info, Layers, Medal, Percent, RefreshCw, TrendingDown, TrendingUp, X,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, ProgressBar, Segmented } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/Feedback.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { CategoryDonutChart, DailySpendChart, IncomeExpenseChart, WeeklyBars } from '../charts/index.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { categoryApi, reportApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney, formatPercent, toDateInput } from '../utils/format.js';

const PRESETS = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-3', label: 'Last 3 months' },
  { key: 'last-6', label: 'Last 6 months' },
  { key: 'semester', label: 'This semester' },
  { key: 'custom', label: 'Custom' },
];

function rangeFor(preset) {
  const now = new Date();
  const startOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const endOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

  switch (preset) {
    case 'last-month': {
      const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return { from: toDateInput(startOfMonth(previous)), to: toDateInput(endOfMonth(previous)) };
    }
    case 'last-3':
      return { from: toDateInput(startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)))), to: toDateInput(now) };
    case 'last-6':
      return { from: toDateInput(startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)))), to: toDateInput(now) };
    case 'semester': {
      const year = now.getUTCFullYear();
      const semesterStart = now.getUTCMonth() >= 6 ? new Date(Date.UTC(year, 6, 1)) : new Date(Date.UTC(year, 0, 1));
      return { from: toDateInput(semesterStart), to: toDateInput(now) };
    }
    case 'this-month':
    default:
      return { from: toDateInput(startOfMonth(now)), to: toDateInput(now) };
  }
}

export default function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const symbol = currencySymbol(user?.preferences?.currency);
  const reportRef = useRef(null);

  const [preset, setPreset] = useState('this-month');
  const [range, setRange] = useState(() => rangeFor('this-month'));
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState('');
  const [granularity, setGranularity] = useState('daily');
  const [exporting, setExporting] = useState('');

  const { data: categoryData } = useApi(() => categoryApi.list(), { deps: [] });

  const query = useMemo(
    () => ({ from: range.from, to: range.to, category: categoryId || undefined, type: type || undefined }),
    [range, categoryId, type],
  );

  const { data, isLoading, error, reload, refresh, isRefreshing } = useApi(() => reportApi.get(query), {
    deps: [JSON.stringify(query)],
  });

  const saveAction = useApiAction((payload) => reportApi.save(payload), {
    onSuccess: () => toast.success('Report snapshot saved', { description: 'Find it under Bookmarks.' }),
    onError: (err) => toast.fromError(err, 'Could not save this snapshot'),
  });

  const applyPreset = (nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') setRange(rangeFor(nextPreset));
  };

  /* ── CSV export: real server-generated file ───────────────────────── */
  const exportCsv = async () => {
    setExporting('csv');
    try {
      const result = await reportApi.exportCsv(query);
      toast.success('CSV downloaded', { description: `${result.filename} (${Math.round((result.bytes || 0) / 1024)} KB)` });
    } catch (err) {
      toast.fromError(err, 'Could not export the CSV');
    } finally {
      setExporting('');
    }
  };

  /* ── PDF export: jsPDF + html2canvas of the live report ───────────── */
  const exportPdf = async () => {
    if (!data) return;
    setExporting('pdf');
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
      const node = reportRef.current;
      const canvas = await html2canvas(node, {
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
        useCORS: true,
        windowWidth: node.scrollWidth,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const usableWidth = pageWidth - margin * 2;

      // Header
      pdf.setFillColor(109, 93, 251);
      pdf.rect(0, 0, pageWidth, 64, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.text('Campus Coin — Spending Report', margin, 30);
      pdf.setFontSize(10);
      pdf.text(`${user?.name || 'Student'} · ${data.range.label}`, margin, 46);
      pdf.text(`Generated ${new Date().toLocaleString('en-GB')}`, pageWidth - margin, 46, { align: 'right' });

      // Key figures
      pdf.setTextColor(17, 24, 39);
      pdf.setFontSize(11);
      let y = 92;
      const figures = [
        ['Income', formatMoney(data.overview.income, symbol)],
        ['Expenses', formatMoney(data.overview.expense, symbol)],
        ['Net saved', formatMoney(data.overview.net, symbol)],
        ['Savings rate', `${data.overview.savingsRate}%`],
        ['Transactions', String(data.overview.transactionCount)],
        ['Average transaction', formatMoney(data.overview.averageTransaction, symbol)],
      ];
      figures.forEach(([label, value], index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = margin + column * (usableWidth / 3);
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 135);
        pdf.text(label.toUpperCase(), x, y + row * 34);
        pdf.setFontSize(13);
        pdf.setTextColor(17, 24, 39);
        pdf.text(value, x, y + row * 34 + 16);
      });
      y += 84;

      // Category table
      pdf.setFontSize(12);
      pdf.text('Expenses by category', margin, y);
      y += 16;
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 135);
      pdf.text('Category', margin, y);
      pdf.text('Total', pageWidth - margin - 150, y, { align: 'right' });
      pdf.text('Count', pageWidth - margin - 80, y, { align: 'right' });
      pdf.text('Share', pageWidth - margin, y, { align: 'right' });
      y += 6;
      pdf.setDrawColor(230, 230, 240);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 14;

      const totalExpense = data.byCategory.expense.reduce((sum, row) => sum + row.total, 0) || 1;
      data.byCategory.expense.slice(0, 14).forEach((row) => {
        pdf.setTextColor(17, 24, 39);
        pdf.setFontSize(9.5);
        pdf.text(row.name.slice(0, 34), margin, y);
        pdf.text(formatMoney(row.total, symbol), pageWidth - margin - 150, y, { align: 'right' });
        pdf.text(String(row.count), pageWidth - margin - 80, y, { align: 'right' });
        pdf.text(`${Math.round((row.total / totalExpense) * 100)}%`, pageWidth - margin, y, { align: 'right' });
        y += 15;
      });

      y += 12;
      if (y > pageHeight - 260) {
        pdf.addPage();
        y = 60;
      }

      // Chart image
      pdf.setFontSize(12);
      pdf.setTextColor(17, 24, 39);
      pdf.text('Visual summary', margin, y);
      y += 12;
      const imageHeight = Math.min(300, (canvas.height / canvas.width) * usableWidth);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.86), 'JPEG', margin, y, usableWidth, imageHeight);
      y += imageHeight + 18;

      // Budget + notes
      if (data.budgets?.rows?.length) {
        if (y > pageHeight - 120) {
          pdf.addPage();
          y = 60;
        }
        pdf.setFontSize(12);
        pdf.text('Budget performance', margin, y);
        y += 16;
        pdf.setFontSize(9.5);
        data.budgets.rows.slice(0, 8).forEach((row) => {
          pdf.setTextColor(17, 24, 39);
          pdf.text(row.categoryName.slice(0, 30), margin, y);
          pdf.text(`${formatMoney(row.spent, symbol)} / ${formatMoney(row.limit, symbol)} (${Math.round(row.percentUsed)}%)`, pageWidth - margin, y, { align: 'right' });
          y += 15;
        });
        y += 10;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(140, 140, 155);
      pdf.text(
        'Generated by Campus Coin (Smart Spending, Student Style). Figures come from your own logged transactions; tips and AI suggestions are guidance, not financial advice.',
        margin,
        pageHeight - 32,
        { maxWidth: usableWidth },
      );

      pdf.save(`campus-coin-report-${range.from}-to-${range.to}.pdf`);
      toast.success('PDF downloaded', { description: 'Charts and category tables are embedded in the file.' });
    } catch (err) {
      toast.error('Could not build the PDF', { description: err.message || 'Please try again.' });
    } finally {
      setExporting('');
    }
  };

  const overview = data?.overview;
  const categories = categoryData?.categories || [];
  const hasData = overview && overview.transactionCount > 0;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Monthly and custom-range analysis with real CSV and PDF exports generated from your own data."
        crumbs={[{ label: 'Reports' }]}
        icon={BarChart3}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={() => refresh()}>Refresh</Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              disabled={!hasData}
              loading={exporting === 'csv'}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
            <Button size="sm" icon={FileText} disabled={!hasData} loading={exporting === 'pdf'} onClick={exportPdf}>
              Export PDF
            </Button>
          </>
        }
      />

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => applyPreset(option.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                preset === option.key
                  ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                  : 'border-surface-border text-ink-muted hover:border-brand-400/40'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3.5 grid gap-3 border-t border-surface-border pt-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="cc-label">From</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(event) => { setPreset('custom'); setRange((prev) => ({ ...prev, from: event.target.value })); }}
              className="cc-input"
            />
          </label>
          <label className="block">
            <span className="cc-label">To</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={toDateInput(new Date())}
              onChange={(event) => { setPreset('custom'); setRange((prev) => ({ ...prev, to: event.target.value })); }}
              className="cc-input"
            />
          </label>
          <label className="block">
            <span className="cc-label">Category</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="cc-select">
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="cc-label">Type</span>
            <select value={type} onChange={(event) => setType(event.target.value)} className="cc-select">
              <option value="">Income &amp; expenses</option>
              <option value="expense">Expenses only</option>
              <option value="income">Income only</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-ink-soft">
          <Filter className="h-3.5 w-3.5" />
          <span>
            Showing <strong className="text-ink-muted">{data?.range?.label || '—'}</strong> · {overview?.transactionCount || 0} transactions
            {overview?.categoriesUsed ? ` · ${overview.categoriesUsed} categories used` : ''}
            {overview?.monthsCovered ? ` · ${overview.monthsCovered} month(s) covered` : ''}
          </span>
          {(categoryId || type) && (
            <button type="button" onClick={() => { setCategoryId(''); setType(''); }} className="cc-link inline-flex items-center gap-1">
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} rows={2} />)}
          </div>
          <SkeletonCard rows={8} />
        </div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : !hasData ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title="Nothing in this range"
            description="No transactions were logged between those dates. Widen the range or clear the filters."
            actionLabel="Reset to this month"
            onAction={() => { applyPreset('this-month'); setCategoryId(''); setType(''); }}
          />
        </Card>
      ) : (
        <div ref={reportRef} className="space-y-5">
          {/* Overview */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-2xs uppercase tracking-wide text-ink-soft">Income</p>
              <p className="mt-1 font-display text-xl font-bold tabular text-mint-600 dark:text-mint-400">{formatMoney(overview.income, symbol, { decimals: 0 })}</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xs uppercase tracking-wide text-ink-soft">Expenses</p>
              <p className="mt-1 font-display text-xl font-bold tabular text-rose-600 dark:text-rose-400">{formatMoney(overview.expense, symbol, { decimals: 0 })}</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xs uppercase tracking-wide text-ink-soft">Net saved</p>
              <p className={`mt-1 font-display text-xl font-bold tabular ${overview.net >= 0 ? 'text-mint-600 dark:text-mint-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatMoney(overview.net, symbol, { decimals: 0 })}
              </p>
              <p className="text-2xs text-ink-soft">Savings rate {formatPercent(overview.savingsRate)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xs uppercase tracking-wide text-ink-soft">Average transaction</p>
              <p className="mt-1 font-display text-xl font-bold tabular text-ink">{formatMoney(overview.averageTransaction, symbol)}</p>
              <p className="text-2xs text-ink-soft">Median expense {formatMoney(overview.medianExpense, symbol)}</p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-5">
              <CardHeader
                title={granularity === 'daily' ? 'Daily spending' : granularity === 'weekly' ? 'Weekly rhythm' : 'Monthly totals'}
                subtitle={data.range.label}
                icon={CalendarRange}
                action={
                  <Segmented
                    ariaLabel="Granularity"
                    size="sm"
                    value={granularity}
                    onChange={setGranularity}
                    options={[
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'monthly', label: 'Monthly' },
                    ]}
                  />
                }
              />
              {granularity === 'daily' && <DailySpendChart data={data.daily} currency={symbol} height={250} />}
              {granularity === 'weekly' && <WeeklyBars data={data.weekly} currency={symbol} height={250} />}
              {granularity === 'monthly' && <IncomeExpenseChart data={data.byMonth} currency={symbol} height={250} />}
            </Card>

            <Card className="p-5">
              <CardHeader title="Category split" subtitle={`${data.byCategory.expense.length} categories with spending`} icon={Layers} />
              <CategoryDonutChart data={data.byCategory.expense} currency={symbol} height={250} centerLabel="Expenses" />
            </Card>
          </div>

          {/* Six-month trend */}
          <Card className="p-5">
            <CardHeader title="Six-month trend" subtitle="Income, expenses and the gap between them" icon={TrendingUp} />
            <IncomeExpenseChart data={data.sixMonthTrend} currency={symbol} height={250} />
          </Card>

          {/* Category tables */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <CardHeader title="Expenses by category" subtitle="Highest spend first" icon={TrendingDown} />
              <div className="cc-scroll-x">
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th className="cc-th">Category</th>
                      <th className="cc-th text-right">Total</th>
                      <th className="cc-th text-right">#</th>
                      <th className="cc-th text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCategory.expense.map((row) => {
                      const share = overview.expense ? (row.total / overview.expense) * 100 : 0;
                      return (
                        <tr key={row.categoryId || row.name} className="cc-tr">
                          <td className="cc-td">
                            <span className="inline-flex items-center gap-2">
                              <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ backgroundColor: `${row.color}1F`, color: row.color }}>
                                <CategoryIcon name={row.icon} className="h-3 w-3" />
                              </span>
                              {row.name}
                            </span>
                          </td>
                          <td className="cc-td text-right tabular font-medium">{formatMoney(row.total, symbol)}</td>
                          <td className="cc-td text-right tabular text-ink-muted">{row.count}</td>
                          <td className="cc-td text-right tabular text-ink-muted">{Math.round(share)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="p-5">
                <CardHeader title="Income by category" subtitle="Where the money came from" icon={ArrowUpRight} />
                <ul className="space-y-2.5">
                  {data.byCategory.income.map((row) => (
                    <li key={row.categoryId || row.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: `${row.color}1F`, color: row.color }}>
                          <CategoryIcon name={row.icon} className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-ink">{row.name}</span>
                        <span className="text-2xs text-ink-soft">{row.count} entries</span>
                      </span>
                      <span className="tabular font-semibold text-mint-600 dark:text-mint-400">{formatMoney(row.total, symbol)}</span>
                    </li>
                  ))}
                  {data.byCategory.income.length === 0 && <li className="text-xs text-ink-soft">No income recorded in this range.</li>}
                </ul>
              </Card>

              <Card className="p-5">
                <CardHeader title="Biggest movers" subtitle="Versus your own average" icon={Medal} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-rose-500">
                      <ArrowUpRight className="h-3 w-3" /> Increases
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {data.movers.increases.slice(0, 4).map((row) => (
                        <li key={row.categoryName} className="text-xs">
                          <span className="text-ink">{row.categoryName}</span>
                          <span className="ml-1 tabular text-rose-500">
                            {row.changePercent > 0 ? '+' : ''}{Math.round(row.changePercent)}%
                          </span>
                          <span className="block text-2xs text-ink-soft">{formatMoney(row.delta, symbol)} more</span>
                        </li>
                      ))}
                      {data.movers.increases.length === 0 && <li className="text-2xs text-ink-soft">Nothing increased.</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-mint-600">
                      <ArrowDownRight className="h-3 w-3" /> Decreases
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {data.movers.decreases.slice(0, 4).map((row) => (
                        <li key={row.categoryName} className="text-xs">
                          <span className="text-ink">{row.categoryName}</span>
                          <span className="ml-1 tabular text-mint-600">{Math.round(row.changePercent)}%</span>
                          <span className="block text-2xs text-ink-soft">{formatMoney(Math.abs(row.delta), symbol)} less</span>
                        </li>
                      ))}
                      {data.movers.decreases.length === 0 && <li className="text-2xs text-ink-soft">Nothing decreased.</li>}
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Averages + budgets */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <CardHeader
                title="Category averages"
                subtitle="Typical entry size versus the monthly average in this range"
                icon={Percent}
              />
              <div className="cc-scroll-x">
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th className="cc-th">Category</th>
                      <th className="cc-th text-right">Per entry</th>
                      <th className="cc-th text-right">Median</th>
                      <th className="cc-th text-right">Monthly avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.averages.slice(0, 8).map((row) => (
                      <tr key={row.categoryId || row.name} className="cc-tr">
                        <td className="cc-td">
                          <span className="inline-flex items-center gap-2">
                            <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ backgroundColor: `${row.color}1F`, color: row.color }}>
                              <CategoryIcon name={row.icon} className="h-3 w-3" />
                            </span>
                            {row.name}
                          </span>
                        </td>
                        <td className="cc-td text-right tabular">{formatMoney(row.averageAmount, symbol)}</td>
                        <td className="cc-td text-right tabular text-ink-muted">{formatMoney(row.medianAmount, symbol)}</td>
                        <td className="cc-td text-right tabular text-ink-muted">{formatMoney(row.monthlyAverage, symbol, { decimals: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-2xs text-ink-soft">
                Averages are computed from your own entries only, over {data.range.label.toLowerCase()}.
              </p>
            </Card>

            <Card className="p-5">
              <CardHeader title="Budget performance" subtitle={
                  data.budgets?.rows?.length
                    ? `${data.budgets.rows.length} cap${data.budgets.rows.length === 1 ? '' : 's'} · ${new Date(data.budgets.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
                    : 'No budgets in this period'
                } icon={BarChart3} />
              {data.budgets?.rows?.length ? (
                <ul className="space-y-3">
                  {data.budgets.rows.map((row) => (
                    <li key={row.id || row.categoryName}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-ink">
                          <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ backgroundColor: `${(row.color || '#6D5DFB')}1F`, color: row.color || '#6D5DFB' }}>
                            <CategoryIcon name={row.icon} className="h-3 w-3" />
                          </span>
                          {row.categoryName}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular text-ink-muted">{formatMoney(row.spent, symbol)} / {formatMoney(row.limit, symbol)}</span>
                          <Badge tone={row.status === 'over' ? 'danger' : row.status === 'near' ? 'warning' : 'success'}>{Math.round(row.percentUsed)}%</Badge>
                        </span>
                      </div>
                      <ProgressBar value={row.percentUsed} tone={row.status === 'over' ? 'danger' : row.status === 'near' ? 'warning' : 'success'} height="h-1.5" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs leading-relaxed text-ink-muted">
                  No budgets matched this range. Create caps on the <strong className="text-ink">Budgets</strong> screen to compare plan
                  against reality here.
                </p>
              )}
            </Card>
          </div>

          {/* Highlights */}
          <Card className="p-5">
            <CardHeader title="Highlights" subtitle="Auto-generated from this range" icon={Info} />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Highlight label="Largest single expense" value={`${formatMoney(overview.largest?.amount || 0, symbol)} · ${overview.largest?.description || '—'}`} hint={overview.largest?.categoryName} />
              <Highlight label="Flagged as unusual" value={`${overview.anomalyCount} transaction${overview.anomalyCount === 1 ? '' : 's'}`} hint="Large or duplicate detection" />
              <Highlight label="Transactions logged" value={String(overview.transactionCount)} hint={`${overview.categoriesUsed} categories`} />
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Bookmark}
                loading={saveAction.isRunning}
                onClick={() =>
                  saveAction.run({
                    rangeLabel: data.range.label,
                    note: `${formatMoney(overview.expense, symbol)} spent · ${formatMoney(overview.net, symbol)} net`,
                    overview: {
                      income: overview.income,
                      expense: overview.expense,
                      net: overview.net,
                      savingsRate: overview.savingsRate,
                      transactionCount: overview.transactionCount,
                    },
                    filters: { from: range.from, to: range.to, category: categoryId || null, type: type || null },
                  })
                }
              >
                Save snapshot to bookmarks
              </Button>
              <Button variant="secondary" size="sm" icon={FileSpreadsheet} loading={exporting === 'csv'} onClick={exportCsv}>
                Download CSV
              </Button>
              <Button variant="secondary" size="sm" icon={FileText} loading={exporting === 'pdf'} onClick={exportPdf}>
                Download PDF
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Highlight({ label, value, hint }) {
  return (
    <li className="rounded-2xl border border-surface-border bg-surface-muted p-3.5">
      <p className="text-2xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-2xs text-ink-soft">{hint}</p>}
    </li>
  );
}
