import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Bell, Bookmark, CalendarDays, CheckCircle2,
  CircleDollarSign, Flame, Info, Lightbulb, Pin, Plus, RefreshCw, Sparkles, Target, TrendingDown, TrendingUp,
  Utensils, Wallet, X, Zap,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, MotionCard } from '../components/ui/Card.jsx';
import { Avatar, Badge, CategoryChip, ProgressBar, Segmented } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, SkeletonCard, SkeletonStats } from '../components/ui/Feedback.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { CategoryDonutChart, DailySpendChart, IncomeExpenseChart, WeeklyBars } from '../charts/index.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { dashboardApi, transactionApi, tipApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney, formatRelative, greeting, monthLabel } from '../utils/format.js';

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [range, setRange] = useState('month');
  const [dismissedChecklist, setDismissedChecklist] = useState(false);

  const symbol = currencySymbol(user?.preferences?.currency);
  const { data, isLoading, error, refresh, isRefreshing, reload } = useApi(() => dashboardApi.get({}), { deps: [] });
  const { data: checklist } = useApi(() => dashboardApi.checklist(), { deps: [] });

  const tipAction = useApiAction(
    ({ id, action }) => tipApi.update(id, action, action === 'pin' ? true : undefined),
    {
      onSuccess: (result, { action }) => {
        const messages = { pin: 'Tip pinned to the top', dismiss: 'Tip dismissed', bookmark: 'Bookmark updated' };
        toast.success(messages[action] || 'Tip updated');
        refresh();
      },
      onError: (err) => toast.fromError(err, 'Could not update that tip'),
    },
  );

  const widgets = data?.widgets;
  const summary = data?.summary;
  const meta = data?.meta;
  const narrativeTrend = useMemo(() => {
    if (range === 'month') return data?.charts?.daily || [];
    return data?.charts?.trend || [];
  }, [range, data]);

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="We could not load your financial overview." />
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      </>
    );
  }

  const checklistItems = checklist?.items || [];
  const showChecklist = checklist && checklist.completed < checklist.total && !checklist.dismissed && !dismissedChecklist;

  return (
    <>
      <PageHeader
        title={isLoading ? 'Loading your dashboard…' : `${greeting()}, ${data?.student?.firstName || 'student'} 👋`}
        description={
          isLoading
            ? 'Crunching your transactions'
            : `${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${meta?.monthLabel} overview${summary?.isPartialMonth ? ` · day ${summary.daysElapsed} of the month` : ''}`
        }
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={() => refresh()}>
              Refresh
            </Button>
            <Link to="/add-transaction" className="cc-btn-primary cc-btn-sm">
              <Plus className="h-3.5 w-3.5" />
              Quick add
            </Link>
          </>
        }
      />

      {showChecklist && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl border border-brand-500/25 bg-brand-500/[.06] p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Zap className="h-4 w-4 text-brand-500" />
                Getting started · {checklist.completed}/{checklist.total} complete
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {checklistItems.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                        item.done
                          ? 'border-mint-500/30 bg-mint-500/8 text-mint-700 dark:text-mint-400'
                          : 'border-surface-border bg-surface text-ink-muted hover:border-brand-400/50'
                      }`}
                    >
                      {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      <span className={item.done ? 'line-through decoration-mint-500/50' : ''}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setDismissedChecklist(true)}
              className="rounded-lg p-1 text-ink-soft transition hover:bg-ink-soft/10 hover:text-ink"
              aria-label="Dismiss getting started checklist"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-5">
          <SkeletonStats count={4} />
          <div className="grid gap-5 lg:grid-cols-3">
            <SkeletonCard className="lg:col-span-2" rows={5} />
            <SkeletonCard rows={5} />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Hero stats ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total balance"
              value={summary.balance}
              prefix={symbol}
              icon={CircleDollarSign}
              tone={summary.balance >= 0 ? 'success' : 'danger'}
              hint={`${summary.lifetimeTransactions} transactions all-time`}
              change={summary.netChange}
              changeSuffix="% net vs last month"
            />
            <StatCard label="Income this month" value={summary.month.income} prefix={symbol} icon={TrendingUp} tone="success" change={summary.incomeChange} />
            <StatCard label="Spent this month" value={summary.month.expense} prefix={symbol} icon={TrendingDown} tone="warning" change={summary.expenseChange} invert />
            <StatCard
              label="Saved this month"
              value={summary.month.net}
              prefix={symbol}
              icon={Target}
              tone={summary.month.net >= 0 ? 'success' : 'danger'}
              hint={`${summary.month.savingsRate}% of income`}
            />
          </div>

          {/* ── Narratives + quick tips ───────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <MotionCard delay={0.05}>
              <Card className="h-full p-5">
                <CardHeader
                  title="This month at a glance"
                  subtitle={`Computed from ${summary.month.transactionCount} transactions in ${meta.monthLabel}`}
                  icon={Sparkles}
                  action={
                    <Segmented
                      ariaLabel="Chart range"
                      size="sm"
                      value={range}
                      onChange={setRange}
                      options={[
                        { value: 'month', label: 'Daily' },
                        { value: 'trend', label: '6 months' },
                      ]}
                    />
                  }
                />
                {range === 'month' ? (
                  <DailySpendChart data={narrativeTrend} currency={symbol} height={230} />
                ) : (
                  <IncomeExpenseChart data={narrativeTrend} currency={symbol} height={230} />
                )}
              </Card>
            </MotionCard>

            <MotionCard delay={0.1}>
              <Card className="h-full p-5">
                <CardHeader title="What changed" subtitle="Real comparisons from your history" icon={Info} />
                <ul className="space-y-2.5">
                  {(widgets.narratives || []).slice(0, 5).map((line, index) => (
                    <li
                      key={`${line.text}-${index}`}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                        line.tone === 'danger'
                          ? 'border-rose-500/25 bg-rose-500/[.06]'
                          : line.tone === 'warning'
                            ? 'border-amber-500/25 bg-amber-500/[.06]'
                            : line.tone === 'success'
                              ? 'border-mint-500/25 bg-mint-500/[.06]'
                              : 'border-surface-border bg-surface-muted'
                      }`}
                    >
                      {line.tone === 'danger' ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      ) : line.tone === 'warning' ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      ) : line.tone === 'success' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-500" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      )}
                      <span className="min-w-0">
                        <span className="block leading-relaxed text-ink">{line.text}</span>
                        {line.cta && (
                          <Link to={line.cta.href} className="cc-link mt-1 inline-block text-xs">
                            {line.cta.label}
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </MotionCard>
          </div>

          {/* ── Charts row ────────────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <MotionCard delay={0.12}>
              <Card className="h-full p-5">
                <CardHeader title="Where it went" subtitle={`${meta.monthLabel} spending by category`} icon={BarChart3} />
                <CategoryDonutChart data={data.charts.categoryShare} currency={symbol} height={250} centerLabel="Spent" />
                <ul className="mt-3 space-y-1.5">
                  {data.charts.categoryShare.slice(0, 4).map((entry) => (
                    <li key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
                        <span className="truncate text-ink-muted">{entry.name}</span>
                      </span>
                      <span className="tabular shrink-0 font-medium text-ink">
                        {formatMoney(entry.value, symbol, { decimals: 0 })} · {entry.share}%
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </MotionCard>

            <MotionCard delay={0.16} className="lg:col-span-2">
              <Card className="h-full p-5">
                <CardHeader
                  title="Six-month trend"
                  subtitle="Income versus expenses across your history"
                  icon={TrendingUp}
                  action={
                    <div className="flex items-center gap-3 text-2xs">
                      <span className="inline-flex items-center gap-1.5 text-ink-muted">
                        <span className="h-2.5 w-2.5 rounded-full bg-mint-500" /> Income
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-ink-muted">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expenses
                      </span>
                    </div>
                  }
                />
                <IncomeExpenseChart data={data.charts.trend} currency={symbol} height={230} showLegend={false} />

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-surface-border bg-surface-muted p-3">
                    <p className="text-2xs uppercase tracking-wide text-ink-soft">Avg monthly spend</p>
                    <p className="mt-1 font-display text-lg font-bold tabular text-ink">{formatMoney(summary.averageMonthlyExpense, symbol, { decimals: 0 })}</p>
                  </div>
                  <div className="rounded-xl border border-surface-border bg-surface-muted p-3">
                    <p className="text-2xs uppercase tracking-wide text-ink-soft">Forecast next month</p>
                    <p className="mt-1 font-display text-lg font-bold tabular text-ink">
                      {widgets.forecast ? formatMoney(widgets.forecast.forecastExpense, symbol, { decimals: 0 }) : '—'}
                    </p>
                    <p className="text-2xs text-ink-soft">{widgets.forecast ? `${widgets.forecast.confidence} confidence · ${widgets.forecast.basedOnMonths} months` : 'Need more history'}</p>
                  </div>
                  <div className="rounded-xl border border-surface-border bg-surface-muted p-3">
                    <p className="text-2xs uppercase tracking-wide text-ink-soft">Weekly rhythm</p>
                    <div className="mt-1">
                      <WeeklyBars data={data.charts.weekly.slice(0, 4)} currency={symbol} height={60} />
                    </div>
                  </div>
                </div>
              </Card>
            </MotionCard>
          </div>

          {/* ── Budgets + alerts ──────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <MotionCard delay={0.18}>
              <Card className="h-full p-5">
                <CardHeader
                  title="Budget vs actual"
                  subtitle={`${widgets.budgets.summary.budgetCount} caps · ${formatMoney(widgets.budgets.summary.totalSpent, symbol, { decimals: 0 })} of ${formatMoney(widgets.budgets.summary.totalLimit, symbol, { decimals: 0 })} used`}
                  icon={BarChart3}
                  action={<Link to="/budgets" className="cc-link text-xs">Manage</Link>}
                />

                {widgets.budgets.rows.length === 0 ? (
                  <EmptyState
                    compact
                    icon={BarChart3}
                    title="No budgets yet"
                    description="Set a monthly cap for your biggest categories and Campus Coin will warn you before you overshoot."
                    actionLabel="Create your first budget"
                    onAction={() => navigate('/budgets')}
                  />
                ) : (
                  <ul className="space-y-4">
                    {widgets.budgets.rows.map((row) => (
                      <li key={row.categoryId}>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <CategoryChip category={{ name: row.categoryName, color: row.color, icon: row.icon }} size="sm" />
                          <span className="flex items-center gap-2 text-xs">
                            <span className="tabular text-ink-muted">
                              {formatMoney(row.spent, symbol, { decimals: 0 })} / {formatMoney(row.limit, symbol, { decimals: 0 })}
                            </span>
                            <Badge tone={row.status === 'over' ? 'danger' : row.status === 'near' ? 'warning' : 'success'}>
                              {Math.round(row.percentUsed)}%
                            </Badge>
                          </span>
                        </div>
                        <ProgressBar
                          value={row.percentUsed}
                          tone={row.status === 'over' ? 'danger' : row.status === 'near' ? 'warning' : 'success'}
                          height="h-2"
                        />
                        <p className="mt-1 text-2xs text-ink-soft">
                          {row.status === 'over'
                            ? `${formatMoney(Math.abs(row.remaining), symbol)} over budget`
                            : `${formatMoney(row.remaining, symbol)} remaining`}
                          {row.transactionCount ? ` · ${row.transactionCount} transactions` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </MotionCard>

            <MotionCard delay={0.2}>
              <Card className="h-full p-5">
                <CardHeader
                  title="Alerts"
                  subtitle={`${widgets.alerts.unread} unread notification${widgets.alerts.unread === 1 ? '' : 's'}`}
                  icon={Bell}
                  action={<Link to="/notifications" className="cc-link text-xs">View all</Link>}
                />
                {widgets.alerts.items.length === 0 ? (
                  <EmptyState compact icon={BadgeCheck} tone="success" title="All quiet" description="No budget alerts or milestones need your attention right now." />
                ) : (
                  <ul className="space-y-2">
                    {widgets.alerts.items.map((alert) => (
                      <li key={alert.id}>
                        <Link
                          to={alert.link || '/notifications'}
                          className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-muted p-3 transition hover:border-brand-400/50"
                        >
                          <span
                            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                              alert.severity === 'danger'
                                ? 'bg-rose-500/14 text-rose-500'
                                : alert.severity === 'warning'
                                  ? 'bg-amber-500/14 text-amber-500'
                                  : alert.severity === 'success'
                                    ? 'bg-mint-500/14 text-mint-600'
                                    : 'bg-brand-500/14 text-brand-500'
                            }`}
                          >
                            {alert.type?.includes('budget') ? <BarChart3 className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-ink">{alert.title}</span>
                            <span className="mt-0.5 block line-clamp-2 text-2xs leading-relaxed text-ink-muted">{alert.message}</span>
                            <span className="mt-1 block text-2xs text-ink-soft">{formatRelative(alert.createdAt)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </MotionCard>
          </div>

          {/* ── Top category / insight / goals ────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <MotionCard delay={0.22}>
              <Card className="h-full p-5">
                <CardHeader title="Top category" subtitle={meta.monthLabel} icon={Utensils} />
                {widgets.topCategory ? (
                  <>
                    <div className="flex items-center gap-3.5">
                      <span
                        className="grid h-12 w-12 place-items-center rounded-2xl"
                        style={{ backgroundColor: `${widgets.topCategory.color}1F`, color: widgets.topCategory.color }}
                      >
                        <CategoryIcon name={widgets.topCategory.icon} className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="font-display text-xl font-bold text-ink">{widgets.topCategory.name}</p>
                        <p className="tabular text-sm text-ink-muted">
                          {formatMoney(widgets.topCategory.total, symbol)} · {widgets.topCategory.share}% of spend
                        </p>
                      </div>
                    </div>
                    <p className="mt-3.5 rounded-xl border border-surface-border bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted">
                      {widgets.topCategory.headline}
                      {Math.abs(widgets.topCategory.changePercent || 0) >= 5 && (
                        <>
                          {' '}
                          That is{' '}
                          <strong className={widgets.topCategory.changePercent > 0 ? 'text-rose-500' : 'text-mint-600'}>
                            {Math.abs(Math.round(widgets.topCategory.changePercent))}% {widgets.topCategory.changePercent > 0 ? 'higher' : 'lower'}
                          </strong>{' '}
                          than last month.
                        </>
                      )}
                    </p>
                    <Button variant="secondary" size="sm" className="mt-3.5 w-full" onClick={() => navigate(`/transactions?category=${widgets.topCategory.categoryId}`)}>
                      See {widgets.topCategory.count} transactions
                    </Button>
                  </>
                ) : (
                  <EmptyState compact icon={Utensils} title="Nothing logged yet" description="Your top category appears once you record expenses." />
                )}
              </Card>
            </MotionCard>

            <MotionCard delay={0.24}>
              <Card className="h-full p-5">
                <CardHeader
                  title="Monthly insight"
                  subtitle={widgets.insight ? (widgets.insight.source === 'ai' ? 'AI-assisted narrative' : 'Generated from your analytics') : 'Not generated yet'}
                  icon={Sparkles}
                  action={<Link to="/insights" className="cc-link text-xs">All insights</Link>}
                />
                {widgets.insight ? (
                  <>
                    <p className="text-sm font-semibold text-ink">{widgets.insight.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">{widgets.insight.summaryText}</p>
                    {widgets.insight.tipText && (
                      <p className="mt-3 rounded-xl border border-brand-500/25 bg-brand-500/8 p-3 text-xs leading-relaxed text-ink">
                        <Lightbulb className="mr-1.5 inline h-3.5 w-3.5 text-brand-500" />
                        {widgets.insight.tipText}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(widgets.insight.highlights || []).slice(0, 3).map((highlight) => (
                        <span key={highlight} className="cc-badge-neutral normal-case">{highlight}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState compact icon={Sparkles} title="No insight for this month" description="Log a few transactions and an insight will generate automatically." />
                )}
              </Card>
            </MotionCard>

            <MotionCard delay={0.26}>
              <Card className="h-full p-5">
                <CardHeader
                  title="Savings goals"
                  subtitle={widgets.goals.length ? `${widgets.goals.length} active` : 'Nothing set up yet'}
                  icon={Target}
                  action={<Link to="/goals" className="cc-link text-xs">Manage</Link>}
                />
                {widgets.goals.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Target}
                    title="No goals yet"
                    description="Set a target — students who name a goal save noticeably more."
                    actionLabel="Create a goal"
                    onAction={() => navigate('/goals')}
                  />
                ) : (
                  <ul className="space-y-4">
                    {widgets.goals.slice(0, 2).map((goal) => (
                      <li key={goal.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <CategoryIcon name={goal.icon} className="h-4 w-4" style={{ color: goal.color }} />
                            <span className="truncate text-sm font-medium text-ink">{goal.name}</span>
                          </span>
                          <span className="tabular shrink-0 text-xs font-semibold text-ink">{goal.progress}%</span>
                        </div>
                        <ProgressBar value={goal.progress} barClass="bg-mint-gradient" height="h-2" />
                        <div className="mt-1.5 flex items-center justify-between text-2xs text-ink-soft">
                          <span className="tabular">{formatMoney(goal.currentAmount, symbol, { decimals: 0 })} of {formatMoney(goal.targetAmount, symbol, { decimals: 0 })}</span>
                          {goal.onTrack !== null && (
                            <Badge tone={goal.onTrack ? 'success' : 'warning'}>{goal.onTrack ? 'On pace' : 'Behind pace'}</Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </MotionCard>
          </div>

          {/* ── Tips + recent activity ────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <MotionCard delay={0.28}>
              <Card className="h-full p-5">
                <CardHeader
                  title="Personalised saving tips"
                  subtitle="Ranked by estimated monthly impact"
                  icon={Lightbulb}
                  action={<Link to="/insights" className="cc-link text-xs">All tips</Link>}
                />
                {widgets.tips.length === 0 ? (
                  <EmptyState compact icon={Lightbulb} title="No tips yet" description="Log more transactions and the engine will find savings in your own numbers." />
                ) : (
                  <ul className="space-y-3">
                    {widgets.tips.map((tip) => (
                      <li key={tip.id} className="rounded-2xl border border-surface-border bg-surface-muted p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                              {tip.pinned && <Pin className="h-3.5 w-3.5 text-brand-500" aria-label="Pinned" />}
                              {tip.title}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{tip.body}</p>
                          </div>
                          {tip.potentialSaving > 0 && (
                            <span className="cc-badge-success shrink-0">+{formatMoney(tip.potentialSaving, symbol, { decimals: 0 })}/mo</span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {tip.actionHref && (
                            <Link to={tip.actionHref} className="cc-btn-secondary cc-btn-sm">
                              {tip.actionLabel || 'Take action'}
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => tipAction.run({ id: tip.id, action: 'pin' })}
                            className="cc-btn-ghost cc-btn-sm"
                            aria-label={tip.pinned ? 'Unpin tip' : 'Pin tip'}
                          >
                            <Pin className="h-3.5 w-3.5" />
                            {tip.pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => tipAction.run({ id: tip.id, action: 'bookmark' })}
                            className="cc-btn-ghost cc-btn-sm"
                            aria-label={tip.bookmarked ? 'Remove bookmark' : 'Bookmark tip'}
                          >
                            <Bookmark className={`h-3.5 w-3.5 ${tip.bookmarked ? 'fill-current text-brand-500' : ''}`} />
                            {tip.bookmarked ? 'Saved' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => tipAction.run({ id: tip.id, action: 'dismiss' })}
                            className="cc-btn-ghost cc-btn-sm ml-auto"
                            aria-label="Dismiss tip"
                          >
                            <X className="h-3.5 w-3.5" />
                            Dismiss
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </MotionCard>

            <MotionCard delay={0.3}>
              <Card className="h-full p-5">
                <CardHeader
                  title="Recent transactions"
                  subtitle="Your latest activity"
                  icon={Wallet}
                  action={<Link to="/transactions" className="cc-link text-xs">See all</Link>}
                />
                {widgets.recentTransactions.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Wallet}
                    title="No transactions yet"
                    description="Add your first entry to bring this dashboard to life."
                    actionLabel="Add transaction"
                    onAction={() => navigate('/add-transaction')}
                  />
                ) : (
                  <ul className="divide-y divide-surface-border">
                    {widgets.recentTransactions.map((tx) => (
                      <li key={tx.id} className="flex items-center gap-3 py-3">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                          style={{ backgroundColor: `${tx.category?.color || '#6D5DFB'}1F`, color: tx.category?.color || '#6D5DFB' }}
                        >
                          <CategoryIcon name={tx.category?.icon} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {tx.description || tx.category?.name || 'Transaction'}
                            {tx.isAnomaly && <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 text-amber-500" aria-label="Flagged as unusual" />}
                          </p>
                          <p className="text-2xs text-ink-soft">
                            {tx.category?.name} · {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <span className={`tabular shrink-0 text-sm font-semibold ${tx.type === 'income' ? 'text-mint-600 dark:text-mint-400' : 'text-ink'}`}>
                          {tx.type === 'income' ? '+' : '−'}
                          {formatMoney(tx.amount, symbol)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <Link to="/add-transaction" className="cc-btn-secondary mt-4 w-full">
                  <Plus className="h-4 w-4" />
                  Quick add expense
                </Link>
              </Card>
            </MotionCard>
          </div>

          {/* ── Footer summary ────────────────────────────────────────── */}
          <MotionCard delay={0.32}>
            <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {meta.monthLabel} · {summary.month.transactionCount} transactions
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  {user?.streak?.current || 0}-day logging streak (best {user?.streak?.longest || 0})
                </span>
                {summary.unspentAllowance !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    {formatMoney(summary.unspentAllowance, symbol)} of your allowance is unspent
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={user?.name} color={user?.avatar?.color} size="xs" />
                  {user?.academicYear || 'Student'}
                </span>
              </div>
              <Link to="/reports" className="cc-btn-primary cc-btn-sm shrink-0">
                Open full report
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          </MotionCard>
        </div>
      )}
    </>
  );
}
