import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownUp, ChevronLeft, ChevronRight, Copy, Download, Filter, Pencil, Plus, RefreshCw,
  Repeat, Search, SlidersHorizontal, Trash2, Wallet, X,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Badge, CategoryChip } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback.jsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { useApi, useApiAction, useDebounced, useMediaQuery } from '../hooks/useApi.js';
import { categoryApi, transactionApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney } from '../utils/format.js';

const PAGE_SIZE = 12;

export default function Transactions() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const symbol = currencySymbol(user?.preferences?.currency);

  const [filters, setFilters] = useState({
    search: params.get('search') || '',
    type: params.get('type') || '',
    category: params.get('category') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    minAmount: '',
    maxAmount: '',
    source: '',
    recurring: '',
    sortBy: 'date',
    sortDir: 'desc',
    page: Number(params.get('page')) || 1,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const debouncedSearch = useDebounced(filters.search, 380);

  const query = useMemo(
    () => ({
      page: filters.page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      type: filters.type || undefined,
      category: filters.category || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      minAmount: filters.minAmount || undefined,
      maxAmount: filters.maxAmount || undefined,
      source: filters.source || undefined,
      recurring: filters.recurring || undefined,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    }),
    [filters, debouncedSearch],
  );

  const { data, meta: pageMeta, isLoading, error, reload, refresh, isRefreshing } = useApi(() => transactionApi.list(query), {
    deps: [JSON.stringify(query)],
  });
  const { data: meta } = useApi(() => transactionApi.meta(), { deps: [] });
  const { data: recurring, reload: reloadRecurring } = useApi(() => transactionApi.recurring(), { deps: [] });

  // Keep the URL in sync so filters survive a refresh and can be shared.
  useEffect(() => {
    const next = new URLSearchParams();
    Object.entries({ ...query, limit: undefined, sortBy: undefined, sortDir: undefined }).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const categoryFromUrl = params.get('category');
    if (categoryFromUrl && categoryFromUrl !== filters.category) {
      setFilters((prev) => ({ ...prev, category: categoryFromUrl, page: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const deleteAction = useApiAction((id) => transactionApi.remove(id), {
    onSuccess: () => {
      toast.success('Transaction deleted');
      setDeleteTarget(null);
      refresh();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not delete that transaction'),
  });

  const duplicateAction = useApiAction((id) => transactionApi.duplicate(id, {}), {
    onSuccess: () => {
      toast.success('Transaction duplicated', { description: 'Change the details as needed.' });
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not duplicate that transaction'),
  });

  const recurringAction = useApiAction(({ id, status }) => transactionApi.setRecurringStatus(id, status), {
    onSuccess: (result, { status }) => {
      toast.success(`Recurring entry ${status}`);
      reloadRecurring();
    },
    onError: (err) => toast.fromError(err, 'Could not update the recurring entry'),
  });

  const runRecurring = useApiAction(() => transactionApi.runRecurring(), {
    onSuccess: (response) => {
      toast.success(response.message || 'Recurring sweep complete', {
        description: response.data?.created ? `${response.data.created} new entries created.` : 'Everything was already up to date.',
      });
      refresh();
      reloadRecurring();
    },
    onError: (err) => toast.fromError(err, 'Could not run the recurring sweep'),
  });

  const transactions = data?.transactions || [];
  const summary = data?.summary;
  const pagination = pageMeta || { page: 1, limit: PAGE_SIZE, totalPages: 1, total: 0, hasNextPage: false, hasPrevPage: false };

  const activeFilterCount = ['type', 'category', 'from', 'to', 'minAmount', 'maxAmount', 'source', 'recurring'].filter(
    (key) => filters[key],
  ).length;

  const resetFilters = () => {
    setFilters((prev) => ({
      search: '',
      type: '',
      category: '',
      from: '',
      to: '',
      minAmount: '',
      maxAmount: '',
      source: '',
      recurring: '',
      sortBy: prev.sortBy,
      sortDir: prev.sortDir,
      page: 1,
    }));
  };

  const exportCsv = () => {
    const query = new URLSearchParams({ from: filters.from, to: filters.to, category: filters.category, type: filters.type });
    window.open(`/api/reports/export.csv?${query.toString()}`, '_blank', 'noopener');
    toast.info('Preparing your CSV export');
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every income and expense you have logged, with search, filters and true pagination."
        crumbs={[{ label: 'Transactions' }]}
        icon={Wallet}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
              Export
            </Button>
            <Button variant="secondary" size="sm" icon={Repeat} onClick={() => setRecurringOpen(true)}>
              Recurring
            </Button>
            <Link to="/add-transaction" className="cc-btn-primary cc-btn-sm">
              <Plus className="h-3.5 w-3.5" />
              Add transaction
            </Link>
          </>
        }
      />

      {/* ── Summary strip ───────────────────────────────────────────── */}
      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Matching', value: summary.count, prefix: '', tone: 'text-ink' },
            { label: 'Income', value: summary.income, prefix: symbol, tone: 'text-mint-600 dark:text-mint-400' },
            { label: 'Expenses', value: summary.expense, prefix: symbol, tone: 'text-rose-600 dark:text-rose-400' },
            { label: 'Net', value: summary.net, prefix: symbol, tone: summary.net >= 0 ? 'text-mint-600 dark:text-mint-400' : 'text-rose-600 dark:text-rose-400' },
          ].map((item) => (
            <Card key={item.label} className="p-3.5">
              <p className="text-2xs uppercase tracking-wide text-ink-soft">{item.label}</p>
              <p className={`mt-1 font-display text-lg font-bold tabular ${item.tone}`}>
                {item.prefix}
                {typeof item.value === 'number' ? formatMoney(item.value, '', { decimals: item.label === 'Matching' ? 0 : 2 }) : item.value}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
              placeholder="Search descriptions and notes…"
              className="cc-input pl-10"
              aria-label="Search transactions"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, search: '', page: 1 }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={`${filters.sortBy}:${filters.sortDir}`}
              onChange={(event) => {
                const [sortBy, sortDir] = event.target.value.split(':');
                setFilters((prev) => ({ ...prev, sortBy, sortDir, page: 1 }));
              }}
              className="cc-select w-auto min-w-[168px]"
              aria-label="Sort transactions"
            >
              {(meta?.sortOptions || [
                { value: 'date:desc', label: 'Newest first' },
                { value: 'date:asc', label: 'Oldest first' },
                { value: 'amount:desc', label: 'Highest amount' },
                { value: 'amount:asc', label: 'Lowest amount' },
              ]).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <Button
              variant={showFilters || activeFilterCount ? 'primary' : 'secondary'}
              size="sm"
              icon={SlidersHorizontal}
              onClick={() => setShowFilters((open) => !open)}
            >
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Button>

            <Button variant="ghost" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={() => refresh()} aria-label="Refresh list">
              Refine
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3.5 grid gap-3 border-t border-surface-border pt-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="cc-label">Type</span>
              <select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value, page: 1 }))} className="cc-select">
                <option value="">All types</option>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
              </select>
            </label>

            <label className="block">
              <span className="cc-label">Category</span>
              <select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value, page: 1 }))} className="cc-select">
                <option value="">All categories</option>
                <optgroup label="Expense">
                  {(meta?.categories || []).filter((c) => c.type === 'expense').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Income">
                  {(meta?.categories || []).filter((c) => c.type === 'income').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label className="block">
              <span className="cc-label">From date</span>
              <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value, page: 1 }))} className="cc-input" />
            </label>

            <label className="block">
              <span className="cc-label">To date</span>
              <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value, page: 1 }))} className="cc-input" />
            </label>

            <label className="block">
              <span className="cc-label">Min amount</span>
              <input
                type="number"
                min="0"
                value={filters.minAmount}
                onChange={(e) => setFilters((p) => ({ ...p, minAmount: e.target.value, page: 1 }))}
                className="cc-input"
                placeholder="0"
              />
            </label>

            <label className="block">
              <span className="cc-label">Max amount</span>
              <input
                type="number"
                min="0"
                value={filters.maxAmount}
                onChange={(e) => setFilters((p) => ({ ...p, maxAmount: e.target.value, page: 1 }))}
                className="cc-input"
                placeholder="Any"
              />
            </label>

            <label className="block">
              <span className="cc-label">Source</span>
              <select value={filters.source} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value, page: 1 }))} className="cc-select">
                <option value="">Any source</option>
                <option value="manual">Manual entry</option>
                <option value="csv">CSV import</option>
                <option value="recurring">Recurring</option>
                <option value="seed">Demo data</option>
              </select>
            </label>

            <label className="block">
              <span className="cc-label">Recurring</span>
              <select value={filters.recurring} onChange={(e) => setFilters((p) => ({ ...p, recurring: e.target.value, page: 1 }))} className="cc-select">
                <option value="">All</option>
                <option value="true">Recurring only</option>
                <option value="false">One-off only</option>
              </select>
            </label>

            <div className="sm:col-span-2 lg:col-span-4">
              <Button variant="secondary" size="sm" icon={Filter} onClick={resetFilters}>
                Clear all filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── List ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Card className="divide-y divide-surface-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </Card>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : transactions.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={activeFilterCount || filters.search ? 'No transactions match those filters' : 'No transactions yet'}
            description={
              activeFilterCount || filters.search
                ? 'Try widening the date range, clearing the search box or removing a filter.'
                : 'Log your first income or expense — or import a CSV of your past spending.'
            }
            actionLabel={activeFilterCount || filters.search ? 'Clear filters' : 'Add your first transaction'}
            onAction={activeFilterCount || filters.search ? resetFilters : () => navigate('/add-transaction')}
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          {isDesktop ? (
            <Card className="overflow-hidden">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th className="cc-th">Date</th>
                    <th className="cc-th">Description</th>
                    <th className="cc-th">Category</th>
                    <th className="cc-th">Source</th>
                    <th className="cc-th text-right">Amount</th>
                    <th className="cc-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id || tx._id} className="cc-tr">
                      <td className="cc-td whitespace-nowrap text-ink-muted">
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="cc-td">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[260px] truncate font-medium">{tx.description || '—'}</span>
                          {tx.isAnomaly && (
                            <span title={tx.anomalyReason || 'Unusually large for this category'}>
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Flagged as unusual" />
                            </span>
                          )}
                          {tx.recurring && <Repeat className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-label="Recurring transaction" />}
                        </div>
                        {tx.notes && <p className="mt-0.5 max-w-[320px] truncate text-2xs text-ink-soft">{tx.notes}</p>}
                      </td>
                      <td className="cc-td">
                        {tx.category ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="grid h-7 w-7 place-items-center rounded-lg"
                              style={{ backgroundColor: `${tx.category.color}1F`, color: tx.category.color }}
                            >
                              <CategoryIcon name={tx.category.icon} className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-sm">{tx.category.name}</span>
                          </span>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="cc-td">
                        <Badge tone={tx.source === 'csv' ? 'info' : tx.source === 'recurring' ? 'warning' : 'neutral'}>{tx.source}</Badge>
                      </td>
                      <td className={`cc-td text-right tabular font-semibold ${tx.type === 'income' ? 'text-mint-600 dark:text-mint-400' : 'text-ink'}`}>
                        {tx.type === 'income' ? '+' : '−'}
                        {formatMoney(tx.amount, symbol)}
                      </td>
                      <td className="cc-td">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/edit-transaction/${tx.id || tx._id}`} className="cc-btn-ghost cc-btn-icon-sm" aria-label={`Edit ${tx.description || 'transaction'}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => duplicateAction.run(tx.id || tx._id)}
                            className="cc-btn-ghost cc-btn-icon-sm"
                            aria-label={`Duplicate ${tx.description || 'transaction'}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(tx)}
                            className="cc-btn-ghost cc-btn-icon-sm text-rose-500 hover:bg-rose-500/10"
                            aria-label={`Delete ${tx.description || 'transaction'}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            /* Mobile cards */
            <ul className="space-y-2.5">
              {transactions.map((tx) => (
                <li key={tx.id || tx._id}>
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                        style={{ backgroundColor: `${tx.category?.color || '#6D5DFB'}1F`, color: tx.category?.color || '#6D5DFB' }}
                      >
                        <CategoryIcon name={tx.category?.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{tx.description || tx.category?.name || 'Transaction'}</p>
                          <span className={`tabular shrink-0 text-sm font-bold ${tx.type === 'income' ? 'text-mint-600 dark:text-mint-400' : 'text-ink'}`}>
                            {tx.type === 'income' ? '+' : '−'}
                            {formatMoney(tx.amount, symbol)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-2xs text-ink-soft">
                          {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ·{' '}
                          {tx.category?.name || 'Uncategorised'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {tx.isAnomaly && <Badge tone="warning">Unusual</Badge>}
                          {tx.recurring && <Badge tone="info">Recurring</Badge>}
                          {tx.source === 'csv' && <Badge tone="neutral">Imported</Badge>}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Link to={`/edit-transaction/${tx.id || tx._id}`} className="cc-btn-secondary cc-btn-sm flex-1">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                          <Button variant="ghost" size="sm" icon={Copy} onClick={() => duplicateAction.run(tx.id || tx._id)}>
                            Copy
                          </Button>
                          <Button variant="ghost" size="sm" className="text-rose-500" icon={Trash2} onClick={() => setDeleteTarget(tx)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {/* ── Pagination ──────────────────────────────────────────── */}
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-ink-muted">
              Showing <strong className="text-ink">{(pagination.page - 1) * pagination.limit + 1}</strong>–
              <strong className="text-ink">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
              <strong className="text-ink">{pagination.total}</strong> transactions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={!pagination.hasPrevPage}
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                Previous
              </Button>
              <span className="px-2 text-xs tabular text-ink-muted">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                iconRight={ChevronRight}
                disabled={!pagination.hasNextPage}
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Recurring entries ───────────────────────────────────────── */}
      <Modal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        title="Recurring transactions"
        description="Allowance, hostel rent and subscriptions that Campus Coin adds automatically."
        icon={Repeat}
        size="lg"
      >
        {recurring?.templates?.length ? (
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[.06] px-3.5 py-3">
            <p className="text-xs leading-relaxed text-ink-muted">
              Campus Coin materialises recurring entries the moment you open a screen — or on a schedule if you call the
              maintenance script. Next occurrences are shown in your local date format.
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              loading={runRecurring.isRunning}
              onClick={() => runRecurring.run()}
            >
              Run due entries now
            </Button>
          </div>
        ) : null}

        {!recurring?.templates?.length ? (
          <EmptyState
            compact
            icon={Repeat}
            title="No recurring entries"
            description="Mark a transaction as recurring when you add it (for example a monthly allowance or a subscription) and it will appear here."
            actionLabel="Add a transaction"
            onAction={() => navigate('/add-transaction')}
          />
        ) : (
          <ul className="space-y-2.5">
            {recurring.templates.map((template) => (
              <li key={template.id || template._id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-muted p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryChip category={template.category} size="sm" showName={false} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{template.description || template.category?.name}</p>
                    <p className="text-2xs text-ink-soft">
                      {template.recurringFrequency} · next on{' '}
                      {template.nextOccurrence ? new Date(template.nextOccurrence).toLocaleDateString('en-GB') : '—'} ·{' '}
                      {formatMoney(template.amount, symbol)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={template.recurringStatus === 'active' ? 'success' : template.recurringStatus === 'paused' ? 'warning' : 'neutral'}>
                    {template.recurringStatus}
                  </Badge>
                  {template.recurringStatus !== 'ended' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={recurringAction.isRunning}
                      onClick={() => recurringAction.run({ id: template._id, status: template.recurringStatus === 'active' ? 'paused' : 'active' })}
                    >
                      {template.recurringStatus === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteAction.run(deleteTarget?.id || deleteTarget?._id)}
        loading={deleteAction.isRunning}
        title="Delete this transaction?"
        message={`“${deleteTarget?.description || 'This transaction'}” of ${formatMoney(deleteTarget?.amount || 0, symbol)} will be removed from your history and your budgets will be recalculated. This cannot be undone.`}
        confirmLabel="Delete transaction"
      />
    </>
  );
}
