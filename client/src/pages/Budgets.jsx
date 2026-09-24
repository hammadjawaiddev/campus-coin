import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, BellRing, CheckCircle2, ChevronLeft, ChevronRight, Copy, Lightbulb, Pencil, PiggyBank,
  Plus, RefreshCw, Sparkles, Target, Trash2, TrendingUp, Wand2,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, ProgressBar } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/Feedback.jsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { BudgetCompareChart } from '../charts/index.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { budgetApi, categoryApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney, monthKey, monthLabel } from '../utils/format.js';

const shiftMonth = (date, delta) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));

export default function Budgets() {
  const { user } = useAuth();
  const toast = useToast();
  const symbol = currencySymbol(user?.preferences?.currency);

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const month = monthKey(monthCursor);

  const { data, isLoading, error, reload, refresh, isRefreshing } = useApi(() => budgetApi.list({ month }), { deps: [month] });
  const { data: insights } = useApi(() => budgetApi.insights({ month }), { deps: [month] });
  const { data: categoryData } = useApi(() => categoryApi.list(), { deps: [] });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ categoryId: '', limitAmount: '', alertThreshold: 80, note: '' });
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const currency = symbol;

  const saveAction = useApiAction((payload) => budgetApi.save(payload), {
    onSuccess: () => {
      toast.success(editing ? 'Budget updated' : 'Budget saved', { description: 'Alerts will re-evaluate automatically.' });
      setEditorOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteAction = useApiAction((id) => budgetApi.remove(id), {
    onSuccess: () => {
      toast.success('Budget removed');
      setDeleteTarget(null);
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not remove that budget'),
  });

  const copyAction = useApiAction(() => budgetApi.copyPrevious({ month }), {
    onSuccess: (response) => {
      toast.success(response.message || 'Budgets copied', { description: `${response.data?.created ?? 0} cap(s) added from the previous month.` });
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not copy last month'),
  });

  const resetAction = useApiAction(() => budgetApi.resetAlerts({ month }), {
    onSuccess: () => {
      toast.success('Alerts cleared for this month');
      refresh();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not reset the alerts'),
  });

  const budgets = data?.budgets || [];
  const summary = data?.summary;
  const suggestions = data?.suggestions || [];
  const categories = categoryData?.categories || [];

  const budgetedCategories = useMemo(() => new Set(budgets.map((row) => row.categoryId)), [budgets]);
  const availableCategories = categories.filter((category) => category.type === 'expense' && !budgetedCategories.has(category.id));

  const isCurrentMonth = month === monthKey(new Date());
  const monthLabelText = monthLabel(monthCursor);

  const openCreate = (presetCategoryId) => {
    setEditing(null);
    setForm({
      categoryId: presetCategoryId || availableCategories[0]?.id || '',
      limitAmount: '',
      alertThreshold: 80,
      note: '',
    });
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      categoryId: row.categoryId,
      limitAmount: String(row.limit),
      alertThreshold: row.alertThreshold ?? 80,
      note: row.note || '',
    });
    setFormError('');
    setEditorOpen(true);
  };

  const submit = (event) => {
    event.preventDefault();
    const limit = Number(form.limitAmount);
    if (!form.categoryId) return setFormError('Choose a category');
    if (!limit || limit <= 0) return setFormError('Enter a monthly cap greater than zero');
    setFormError('');
    return saveAction.run({
      categoryId: form.categoryId,
      limitAmount: limit,
      month,
      alertThreshold: Number(form.alertThreshold),
      note: form.note,
    });
  };

  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  const overRows = budgets.filter((row) => row.status === 'over');
  const nearRows = budgets.filter((row) => row.status === 'near');

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monthly caps per category with progress tracking and alerts before you overshoot."
        crumbs={[{ label: 'Budgets' }]}
        icon={BarChart3}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={Copy} loading={copyAction.isRunning} onClick={() => copyAction.run()}>
              Copy last month
            </Button>
            <Button variant="secondary" size="sm" icon={BellRing} loading={resetAction.isRunning} onClick={() => resetAction.run()}>
              Reset alerts
            </Button>
            <Button size="sm" icon={Plus} onClick={() => openCreate()}>
              New budget
            </Button>
          </>
        }
      />

      {/* Month switcher */}
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon-sm" icon={ChevronLeft} onClick={() => setMonthCursor((prev) => shiftMonth(prev, -1))} aria-label="Previous month" />
          <div className="min-w-[140px] text-center">
            <p className="text-sm font-semibold text-ink">{monthLabelText} {monthCursor.getUTCFullYear()}</p>
            <p className="text-2xs text-ink-soft">{isCurrentMonth ? 'Current month' : 'Past planning month'}</p>
          </div>
          <Button
            variant="secondary"
            size="icon-sm"
            icon={ChevronRight}
            disabled={monthCursor >= new Date()}
            onClick={() => setMonthCursor((prev) => shiftMonth(prev, 1))}
            aria-label="Next month"
          />
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" onClick={() => setMonthCursor(new Date())}>Back to this month</Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={() => refresh()}>Refresh</Button>
        </div>
      </Card>

      {/* Summary */}
      {summary && budgets.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Total budgeted</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-ink">{formatMoney(summary.totalLimit, symbol, { decimals: 0 })}</p>
            <p className="text-2xs text-ink-soft">{summary.budgetCount} categories</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Spent</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-ink">{formatMoney(summary.totalSpent, symbol, { decimals: 0 })}</p>
            <ProgressBar value={summary.percentUsed} tone={summary.percentUsed > 100 ? 'danger' : summary.percentUsed >= 80 ? 'warning' : 'success'} height="h-1.5" className="mt-2" />
          </Card>
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Remaining</p>
            <p className={`mt-1 font-display text-xl font-bold tabular ${summary.totalRemaining < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-mint-600 dark:text-mint-400'}`}>
              {formatMoney(summary.totalRemaining, symbol, { decimals: 0 })}
            </p>
            <p className="text-2xs text-ink-soft">Across {summary.budgetCount} caps</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Unbudgeted spending</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-ink">{formatMoney(summary.unbudgetedSpend, symbol, { decimals: 0 })}</p>
            <p className="text-2xs text-ink-soft">
              {summary.overCount} over · {summary.nearCount} near the cap
            </p>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {(overRows.length > 0 || nearRows.length > 0) && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {overRows.length > 0 && (
            <Card className="border-rose-500/30 bg-rose-500/[.05] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                {overRows.length} budget{overRows.length === 1 ? '' : 's'} exceeded
              </p>
              <ul className="mt-2 space-y-1.5">
                {overRows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                    <span>{row.categoryName}</span>
                    <span className="tabular font-medium text-ink">{formatMoney(Math.abs(row.remaining), symbol)} over</span>
                  </li>
                ))}
              </ul>
              <Link to="/insights" className="cc-link mt-3 inline-flex items-center gap-1 text-xs">
                See what to do about it
                <ChevronRight className="h-3 w-3" />
              </Link>
            </Card>
          )}
          {nearRows.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/[.05] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <BellRing className="h-4 w-4" />
                {nearRows.length} budget{nearRows.length === 1 ? '' : 's'} close to the cap
              </p>
              <ul className="mt-2 space-y-1.5">
                {nearRows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                    <span>{row.categoryName}</span>
                    <span className="tabular font-medium text-ink">{formatMoney(row.remaining, symbol)} left</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard rows={6} />
          <SkeletonCard rows={6} />
        </div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title={`No budgets for ${monthLabelText}`}
            description="Set caps on the categories where you actually spend — food, transport, subscriptions — and Campus Coin warns you while there is still time to adjust."
            actionLabel="Create your first budget"
            onAction={() => openCreate()}
            secondaryAction={
              suggestions.length ? (
                <Button variant="secondary" onClick={() => copyAction.run()} icon={Sparkles}>
                  Apply {suggestions.length} suggested budgets
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader
              title="Budget performance"
              subtitle={`${monthLabelText} · sorted by pressure on the cap`}
              icon={BarChart3}
            />
            <ul className="space-y-4">
              {budgets.map((row) => (
                <li key={row.id} className="rounded-2xl border border-surface-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${row.color}1F`, color: row.color }}>
                        <CategoryIcon name={row.icon} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold text-ink">
                          {row.categoryName}
                          <Badge tone={row.status === 'over' ? 'danger' : row.status === 'near' ? 'warning' : 'success'}>
                            {row.status === 'over' ? 'Over budget' : row.status === 'near' ? 'Close to cap' : 'On track'}
                          </Badge>
                        </p>
                        <p className="mt-0.5 text-2xs text-ink-soft">
                          {row.transactionCount} transaction{row.transactionCount === 1 ? '' : 's'} · alert at {row.alertThreshold}%
                          {row.note ? ` · ${row.note}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon-sm" icon={Pencil} onClick={() => openEdit(row)} aria-label={`Edit ${row.categoryName} budget`} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-rose-500"
                        icon={Trash2}
                        onClick={() => setDeleteTarget(row)}
                        aria-label={`Remove ${row.categoryName} budget`}
                      />
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="tabular text-ink-muted">
                        {formatMoney(row.spent, symbol)} of {formatMoney(row.limit, symbol)}
                      </span>
                      <span className={`tabular font-semibold ${row.status === 'over' ? 'text-rose-500' : row.status === 'near' ? 'text-amber-500' : 'text-mint-600 dark:text-mint-400'}`}>
                        {Math.round(row.percentUsed)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={row.percentUsed}
                      tone={row.status === 'over' ? 'danger' : row.status === 'near' ? 'warning' : 'success'}
                      height="h-2.5"
                    />
                    <p className="mt-1.5 text-2xs text-ink-soft">
                      {row.remaining >= 0
                        ? `${formatMoney(row.remaining, symbol)} still available${isCurrentMonth ? '' : ' (month closed)'}`
                        : `${formatMoney(Math.abs(row.remaining), symbol)} over the cap`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {data.history?.length > 0 && (
            <Card className="p-5">
              <CardHeader title="Budget vs actual by month" subtitle="Six months of planned spend against what actually happened" icon={TrendingUp} />
              <BudgetCompareChart data={data.history} currency={symbol} height={260} />
            </Card>
          )}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="mt-5 p-5">
          <CardHeader
            title="Suggested caps"
            subtitle="Derived from your own average spending in each category"
            icon={Wand2}
          />
          <ul className="grid gap-3 md:grid-cols-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.categoryId} className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-muted p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${suggestion.color}1F`, color: suggestion.color }}>
                    <CategoryIcon name={suggestion.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{suggestion.name}</p>
                    <p className="text-2xs text-ink-soft">
                      Average {formatMoney(suggestion.averageSpend, symbol, { decimals: 0 })} · {suggestion.reason}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-base font-bold tabular text-ink">{formatMoney(suggestion.suggestedLimit, symbol, { decimals: 0 })}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-1"
                    loading={saveAction.isRunning}
                    onClick={() =>
                      saveAction.run({
                        categoryId: suggestion.categoryId,
                        limitAmount: suggestion.suggestedLimit,
                        month,
                        alertThreshold: 80,
                        note: 'Accepted suggestion',
                      })
                    }
                  >
                    Accept
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Coach notes */}
      {insights?.rows?.length > 0 && (
        <Card className="mt-5 p-5">
          <CardHeader title="Budget coach" subtitle="How your caps compare with your usual spending" icon={Lightbulb} />
          <ul className="space-y-2.5">
            {insights.rows.map((row) => (
              <li key={row.categoryName} className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-muted p-3.5">
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                    row.verdict === 'too-low' ? 'bg-rose-500/14 text-rose-500' : row.verdict === 'too-high' ? 'bg-amber-500/14 text-amber-500' : 'bg-mint-500/14 text-mint-600'
                  }`}
                >
                  {row.verdict === 'too-low' ? <AlertTriangle className="h-3.5 w-3.5" /> : row.verdict === 'too-high' ? <Target className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-ink">
                    {row.categoryName} · cap {formatMoney(row.limit, symbol, { decimals: 0 })} · average {formatMoney(row.averageSpend, symbol, { decimals: 0 })}
                  </p>
                  <p className="mt-0.5 leading-relaxed text-ink-muted">{row.suggestion}</p>
                </div>
              </li>
            ))}
          </ul>
          {insights.unbudgetedSpend > 0 && (
            <p className="mt-3 rounded-xl border border-surface-border bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted">
              <PiggyBank className="mr-1.5 inline h-3.5 w-3.5 text-brand-500" />
              {formatMoney(insights.unbudgetedSpend, symbol, { decimals: 0 })} of this month's spending is in categories without a cap —
              those are the ones most likely to drift.
            </p>
          )}
        </Card>
      )}

      {/* ── Editor ─────────────────────────────────────────────────── */}
      <Modal
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        title={editing ? `Edit ${editing.categoryName} budget` : `New budget · ${monthLabelText}`}
        description="A soft cap with an early warning. Nothing is blocked — you stay in control."
        icon={BarChart3}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
              {formError}
            </div>
          )}

          <label className="block">
            <span className="cc-label">Category</span>
            {editing ? (
              <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-muted px-3 py-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: `${editing.color}1F`, color: editing.color }}>
                  <CategoryIcon name={editing.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm text-ink">{editing.categoryName}</span>
              </div>
            ) : (
              <select value={form.categoryId} onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))} className="cc-select" required>
                <option value="">Choose a category…</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            )}
            {!editing && availableCategories.length === 0 && (
              <span className="mt-1 block text-2xs text-ink-soft">
                Every expense category already has a budget this month — edit an existing one instead.
              </span>
            )}
          </label>

          <label className="block">
            <span className="cc-label">Monthly cap</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-ink-soft">{currency}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.limitAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, limitAmount: event.target.value }))}
                className="cc-input h-12 pl-10 font-display text-lg font-bold tabular"
                placeholder="150"
                required
              />
            </div>
            {editing && (
              <span className="mt-1 block text-2xs text-ink-soft">
                Already spent {formatMoney(editing.spent, symbol)} this month. Your average spend is{' '}
                {formatMoney(editing.spent / Math.max(1, new Date().getUTCDate()) * 30, symbol, { decimals: 0 })} at this pace.
              </span>
            )}
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="cc-label mb-0">Alert threshold</span>
              <span className="text-xs font-semibold text-ink">{form.alertThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={form.alertThreshold}
              onChange={(event) => setForm((prev) => ({ ...prev, alertThreshold: event.target.value }))}
              className="mt-2 w-full accent-brand-500"
              aria-label="Alert threshold percent"
            />
            <span className="mt-1 block text-2xs text-ink-soft">
              You will get a notification when spending reaches {form.alertThreshold}% of the cap.
            </span>
          </div>

          <label className="block">
            <span className="cc-label">Note (optional)</span>
            <input
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              className="cc-input"
              placeholder="Exam month — allow a little more"
              maxLength={120}
            />
          </label>

          {selectedCategory && (
            <p className="rounded-xl border border-surface-border bg-surface-muted p-3 text-2xs leading-relaxed text-ink-muted">
              You have logged {selectedCategory.transactionCount} transaction{selectedCategory.transactionCount === 1 ? '' : 's'} in{' '}
              <strong className="text-ink">{selectedCategory.name}</strong> so far. A cap near{' '}
              {formatMoney(Number(form.limitAmount) || 0, symbol, { decimals: 0 })} keeps your month realistic.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setEditorOpen(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button type="submit" loading={saveAction.isRunning} icon={editing ? Pencil : Plus}>
              {editing ? 'Save changes' : 'Create budget'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteAction.run(deleteTarget?.id)}
        loading={deleteAction.isRunning}
        title={`Remove the ${deleteTarget?.categoryName} budget?`}
        message="Your transactions stay exactly as they are — only the monthly cap and its alerts are removed."
        confirmLabel="Remove budget"
      />
    </>
  );
}
