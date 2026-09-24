import { useMemo, useState } from 'react';
import {
  Activity, BarChart3, ChevronLeft, ChevronRight, DollarSign, Filter, PieChart, Search, Sparkles, TrendingUp,
  Users,
} from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Avatar, Badge, ProgressBar, Segmented } from '../../components/ui/Primitives.jsx';
import CategoryIcon from '../../components/ui/CategoryIcon.jsx';
import { EmptyState, ErrorState, Skeleton, SkeletonCard } from '../../components/ui/Feedback.jsx';
import { CategoryDonutChart, IncomeExpenseChart, NetTrendLine } from '../../charts/index.jsx';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { adminApi } from '../../services/endpoints.js';
import { formatDate, formatMoney } from '../../utils/format.js';

const ROW_LIMIT = 8;

export default function AdminAnalytics() {
  const [months, setMonths] = useState('6');
  const [feed, setFeed] = useState({ type: '', anomalies: false, search: '', page: 1 });

  const { data, isLoading, error, reload, refresh } = useApi(() => adminApi.analytics({ months: Number(months) }), {
    deps: [months],
  });

  const debouncedSearch = useDebounced(feed.search, 350);
  const txQuery = {
    page: feed.page,
    limit: ROW_LIMIT,
    type: feed.type || undefined,
    anomalies: feed.anomalies ? 'true' : undefined,
    search: debouncedSearch.trim() || undefined,
  };
  const { data: txs, meta: txMeta, isLoading: txLoading, refresh: refreshTx } = useApi(
    () => adminApi.transactions(txQuery),
    { deps: [JSON.stringify(txQuery)] },
  );

  const totals = useMemo(() => {
    if (!data) return { newUsers: 0, transactions: 0, income: 0, expense: 0, actions: 0, activeDays: 0 };
    const newUsers = data.userGrowth.reduce((sum, row) => sum + (row.newUsers || 0), 0);
    const transactions = data.transactionVolume.reduce((sum, row) => sum + (row.count || 0), 0);
    const income = data.transactionVolume.reduce((sum, row) => sum + (row.income || 0), 0);
    const expense = data.transactionVolume.reduce((sum, row) => sum + (row.expense || 0), 0);
    const actions = data.activityByDay.reduce((sum, row) => sum + (row.actions || 0), 0);
    return { newUsers, transactions, income, expense, actions, activeDays: data.activityByDay.length };
  }, [data]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Analytics" />
        <div className="space-y-4"><SkeletonCard rows={4} /><SkeletonCard rows={4} /></div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      </>
    );
  }

  const trendRows = data.userGrowth.map((row) => ({ ...row, net: row.totalUsers }));
  const activityRows = data.activityByDay.map((row) => ({ label: formatDate(row.date, 'short'), net: row.actions }));
  const incomeExpenseDonut = data.incomeVsExpense.map((row) => ({
    name: row.type === 'income' ? 'Income' : 'Expense',
    value: row.total,
    color: row.type === 'income' ? '#10B981' : '#F43F5E',
  }));

  const pages = txMeta || { page: 1, totalPages: 1, total: 0, hasNextPage: false, hasPrevPage: false };

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Growth, spending volume and feature usage across the whole platform."
        crumbs={[{ label: 'Analytics' }]}
        icon={BarChart3}
        actions={
          <>
            <Segmented
              ariaLabel="Time window"
              size="sm"
              value={months}
              onChange={(value) => setMonths(value)}
              options={[{ value: '3', label: '3M' }, { value: '6', label: '6M' }, { value: '12', label: '12M' }]}
            />
            <Button variant="secondary" size="sm" onClick={() => { refresh(); refreshTx(); }}>Refresh</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'New students', value: totals.newUsers, hint: `last ${data.range.months} months`, icon: Users },
          { label: 'Transactions', value: totals.transactions, hint: 'logged in the window', icon: Activity },
          { label: 'Volume logged', value: formatMoney(totals.income + totals.expense, '', { decimals: 0 }), hint: `${formatMoney(totals.expense, '', { decimals: 0 })} of it spending`, icon: DollarSign },
          { label: 'Recorded actions', value: totals.actions, hint: `across ${totals.activeDays} active days`, icon: Sparkles },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xs uppercase tracking-wide text-ink-soft">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-amber-500" aria-hidden="true" />
            </div>
            <p className="mt-1.5 font-display text-2xl font-bold tabular text-ink">{stat.value}</p>
            <p className="mt-0.5 text-2xs text-ink-soft">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <CardHeader
            title="Transaction volume"
            subtitle={`Income versus expenses, ${formatDate(data.range.from, 'medium')} onwards`}
            icon={TrendingUp}
          />
          <IncomeExpenseChart data={data.transactionVolume} currency="" height={260} />
        </Card>

        <Card className="p-5">
          <CardHeader title="Income vs expense" subtitle="Totals across the window" icon={PieChart} />
          <CategoryDonutChart data={incomeExpenseDonut} currency="" height={260} centerLabel="Volume" />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Cumulative users" subtitle="Total registered accounts per month" icon={Users} />
          <NetTrendLine data={trendRows} currency="" height={220} />
        </Card>

        <Card className="p-5">
          <CardHeader title="Platform activity" subtitle="Recorded actions per day" icon={Activity} />
          <NetTrendLine data={activityRows} currency="" height={220} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <CardHeader title="Category popularity" subtitle="How often each category is used platform-wide" icon={Filter} />
          <ul className="space-y-3">
            {data.categoryPopularity.slice(0, 10).map((row, index) => {
              const max = Math.max(...data.categoryPopularity.map((entry) => entry.count), 1);
              const color = row.color || ['#F97316', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6'][index % 5];
              return (
                <li key={`${row.name}-${row.type}`}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-ink">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: `${color}22`, color }}>
                        <CategoryIcon name={row.type === 'income' ? 'Wallet' : 'Package'} className="h-3 w-3" />
                      </span>
                      <span className="truncate">{row.name}</span>
                      <Badge tone={row.type === 'income' ? 'success' : 'neutral'}>{row.type}</Badge>
                    </span>
                    <span className="shrink-0 tabular text-ink-muted">
                      {row.count} · {formatMoney(row.total, '', { decimals: 0 })}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-soft/12">
                    <div className="h-full rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Categorisation audit" subtitle="Where categories came from and how often the AI was accepted" icon={Sparkles} />
            <ul className="space-y-3">
              {data.categorization.map((row) => (
                <li key={row.source}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium capitalize text-ink">{row.source.replace(/_/g, ' ')}</span>
                    <span className="tabular text-ink-muted">{row.count} transactions · {row.accuracy}% accepted</span>
                  </div>
                  <ProgressBar
                    value={row.accuracy}
                    tone={row.accuracy >= 80 ? 'success' : row.accuracy >= 50 ? 'warning' : 'danger'}
                    height="h-1.5"
                    className="mt-1.5"
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <CardHeader title="Most active students" subtitle="By lifetime transaction volume" icon={Users} />
            <ul className="divide-y divide-surface-border">
              {data.topStudents.map((student, index) => (
                <li key={student.email} className="flex items-center gap-3 py-2.5">
                  <span className="w-4 text-2xs font-semibold text-ink-soft">{index + 1}</span>
                  <Avatar name={student.name} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{student.name}</span>
                    <span className="block truncate text-2xs text-ink-soft">{student.email}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular text-xs font-semibold text-ink">{formatMoney(student.total, '', { decimals: 0 })}</span>
                    <span className="block text-2xs text-ink-soft">{student.count} transactions</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <CardHeader title="Content library" subtitle="Generated and stored content" icon={BarChart3} />
            <div className="grid grid-cols-2 gap-3 text-xs">
              {Object.entries(data.contentType).map(([key, value]) => (
                <span key={key} className="rounded-xl border border-surface-border bg-surface-muted p-3">
                  <span className="block text-2xs uppercase tracking-wide text-ink-soft">{key}</span>
                  <span className="mt-0.5 block font-display text-lg font-bold tabular text-ink">{value}</span>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Platform transaction feed ─────────────────────────────── */}
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-surface-border p-4">
          <CardHeader title="Recent platform activity" subtitle={`${pages.total} transactions across every account`} icon={Activity} dense />
          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={feed.search}
                onChange={(event) => setFeed((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                className="cc-input pl-10"
                placeholder="Search descriptions…"
                aria-label="Search platform transactions"
              />
            </div>
            <Segmented
              ariaLabel="Transaction type"
              size="sm"
              value={feed.type || 'all'}
              onChange={(value) => setFeed((prev) => ({ ...prev, type: value === 'all' ? '' : value, page: 1 }))}
              options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]}
            />
            <Button
              variant={feed.anomalies ? 'primary' : 'secondary'}
              size="sm"
              icon={Sparkles}
              onClick={() => setFeed((prev) => ({ ...prev, anomalies: !prev.anomalies, page: 1 }))}
            >
              Flagged only
            </Button>
          </div>
        </div>

        {txLoading && !txs ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : !txs?.length ? (
          <EmptyState icon={Activity} title="No transactions match" description="Adjust the search or type filter." compact />
        ) : (
          <div className="cc-scroll-x">
            <table className="cc-table">
              <thead>
                <tr>
                  <th className="cc-th">Date</th>
                  <th className="cc-th">Student</th>
                  <th className="cc-th">Category</th>
                  <th className="cc-th">Description</th>
                  <th className="cc-th text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((row) => (
                  <tr key={row._id} className="cc-tr">
                    <td className="cc-td whitespace-nowrap text-xs text-ink-muted">{formatDate(row.date, 'short')}</td>
                    <td className="cc-td">
                      <span className="flex items-center gap-2">
                        <Avatar name={row.user?.name} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-ink">{row.user?.name || 'unknown'}</span>
                          <span className="block truncate text-2xs text-ink-soft">{row.user?.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="cc-td">
                      {row.category ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                          <span
                            className="grid h-6 w-6 place-items-center rounded-lg"
                            style={{ background: `${row.category.color}22`, color: row.category.color }}
                          >
                            <CategoryIcon name={row.category.icon} className="h-3 w-3" />
                          </span>
                          {row.category.name}
                        </span>
                      ) : (
                        <span className="text-2xs text-ink-soft">uncategorised</span>
                      )}
                    </td>
                    <td className="cc-td max-w-[240px] truncate text-xs text-ink-muted">{row.description}</td>
                    <td className={`cc-td whitespace-nowrap text-right tabular text-sm font-semibold ${row.type === 'income' ? 'text-mint-600' : 'text-ink'}`}>
                      {row.type === 'income' ? '+' : '−'}{formatMoney(row.amount, '', { decimals: 2 })}
                      {row.isAnomaly && <Badge tone="warning" className="ml-2">flagged</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-surface-border p-3.5">
          <p className="text-xs text-ink-muted">
            Page <strong className="text-ink">{pages.page}</strong> of <strong className="text-ink">{pages.totalPages}</strong>
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={feed.page <= 1}
              onClick={() => setFeed((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconRight={ChevronRight}
              disabled={!pages.hasNextPage}
              onClick={() => setFeed((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
