import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Bookmark, Brain, CheckCircle2, Copy, Gauge, Info, Lightbulb, Pin, RefreshCw, RotateCcw,
  ShieldCheck, Sparkles, Target, TrendingUp, Wand2, X, Zap,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, ProgressBar, Segmented } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/Feedback.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { CategoryDonutChart } from '../charts/index.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { insightApi, tipApi, transactionApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney, formatRelative } from '../utils/format.js';

const INSIGHT_PALETTE = ['#F97316', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1', '#94A3B8'];

const SEVERITY_META = {
  danger: { tone: 'danger', label: 'Act now' },
  warning: { tone: 'warning', label: 'Watch' },
  info: { tone: 'info', label: 'Idea' },
  success: { tone: 'success', label: 'Well done' },
};

export default function Insights() {
  const { user } = useAuth();
  const toast = useToast();
  const symbol = currencySymbol(user?.preferences?.currency);

  const [tipTab, setTipTab] = useState('active');
  const [generating, setGenerating] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  const { data: recommendations, isLoading, error, reload, refresh, isRefreshing } = useApi(() => insightApi.recommendations(), { deps: [] });
  const { data: insightHistory, refresh: refreshHistory } = useApi(() => insightApi.list({ limit: 8 }), { deps: [] });
  const { data: accuracy } = useApi(() => insightApi.accuracy(), { deps: [] });
  const { data: detection } = useApi(() => transactionApi.detection(), { deps: [] });
  const { data: tipsData, refresh: refreshTips } = useApi(() => tipApi.list({ includeDismissed: showDismissed }), { deps: [showDismissed] });

  const tipAction = useApiAction(({ id, action }) => tipApi.update(id, action, action === 'pin' ? true : undefined), {
    onSuccess: (response, { action }) => {
      toast.success(response.message || `Tip ${action === 'restore' ? 'restored' : `${action}ned`}`);
      refreshTips();
      refresh();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not update that tip'),
  });

  const insightAction = useApiAction(({ id, action }) => (action === 'bookmark' ? insightApi.bookmark(id) : insightApi.setStatus(id, action)), {
    onSuccess: (response) => {
      toast.success(response.message || 'Insight updated');
      refresh();
      refreshHistory();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not update that insight'),
  });

  const regenerate = async () => {
    setGenerating(true);
    try {
      const response = await insightApi.generate({ force: true });
      toast.success(response.message || 'Insight generated', {
        description: response.data?.insight?.source === 'ai' ? 'Written by the AI assistant.' : 'Generated from your analytics (AI key not configured).',
      });
      const tipsResponse = await tipApi.generate({ limit: 8 });
      toast.info(`${tipsResponse.data?.tips?.length || 0} saving tips refreshed`);
      refresh();
      refreshHistory();
      refreshTips();
    } catch (err) {
      toast.fromError(err, 'Could not regenerate insights');
    } finally {
      setGenerating(false);
    }
  };

  const insight = recommendations?.insight;
  const tips = tipsData?.tips || [];
  const activeTips = tips.filter((tip) => !tip.dismissed || showDismissed);
  const pinnedTips = activeTips.filter((tip) => tip.pinned);
  const otherTips = activeTips.filter((tip) => !tip.pinned);

  const filteredTips = tipTab === 'active'
    ? otherTips
    : tipTab === 'bookmarked'
      ? activeTips.filter((tip) => tip.bookmarked)
      : tipTab === 'high'
        ? otherTips.filter((tip) => tip.potentialSaving >= 20)
        : [...pinnedTips, ...otherTips];

  return (
    <>
      <PageHeader
        title="Insights & tips"
        description="Monthly analysis, ranked saving tips and smart detection — all computed from your own transaction history."
        crumbs={[{ label: 'Insights' }]}
        icon={Sparkles}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={() => { refresh(); refreshTips(); }}>Refresh</Button>
            <Button size="sm" icon={Wand2} loading={generating} onClick={regenerate}>Regenerate</Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-5">
          <SkeletonCard rows={5} />
          <div className="grid gap-4 lg:grid-cols-2"><SkeletonCard rows={4} /><SkeletonCard rows={4} /></div>
        </div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : (
        <div className="space-y-5">
          {/* ── Potential savings hero ────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card className="relative overflow-hidden p-5">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/12 blur-2xl" aria-hidden="true" />
              <div className="relative">
                <span className="cc-badge-info">
                  {recommendations?.ai?.configured ? 'AI-assisted analysis' : 'Analytics engine (no AI key configured)'}
                </span>
                <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">
                  {formatMoney(recommendations?.potentialMonthlySaving || 0, symbol, { decimals: 0 })}
                  <span className="ml-2 text-sm font-medium text-ink-muted">potential monthly saving</span>
                </h2>
                <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-ink-muted">
                  The sum of your ranked tips if you act on them this month. Savings rate right now:{' '}
                  <strong className="text-ink">{recommendations?.savingsRate}%</strong> of income.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/budgets" className="cc-btn-primary cc-btn-sm">Set a budget cap</Link>
                  <Link to="/goals" className="cc-btn-secondary cc-btn-sm">Move money to a goal</Link>
                  <Link to="/reports" className="cc-btn-ghost cc-btn-sm">See the numbers</Link>
                </div>

                <p className="mt-3.5 flex items-start gap-2 rounded-xl border border-surface-border bg-surface-muted p-3 text-2xs leading-relaxed text-ink-soft">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" />
                  {recommendations?.disclaimer}
                </p>
              </div>
            </Card>

            <Card className="p-5">
              <CardHeader title="Budget health" subtitle="This month" icon={Gauge} />
              {recommendations?.budgetHealth && (
                <>
                  <div className="flex items-end justify-between">
                    <span className="font-display text-2xl font-bold tabular text-ink">
                      {Math.round(recommendations.budgetHealth.percentUsed)}%
                    </span>
                    <span className="text-xs text-ink-muted">
                      {formatMoney(recommendations.budgetHealth.totalSpent, symbol, { decimals: 0 })} of{' '}
                      {formatMoney(recommendations.budgetHealth.totalLimit, symbol, { decimals: 0 })}
                    </span>
                  </div>
                  <ProgressBar
                    value={recommendations.budgetHealth.percentUsed}
                    tone={recommendations.budgetHealth.percentUsed > 100 ? 'danger' : recommendations.budgetHealth.percentUsed >= 80 ? 'warning' : 'success'}
                    height="h-2.5"
                    className="mt-3"
                  />
                  <ul className="mt-3.5 space-y-2 text-xs">
                    <li className="flex items-center justify-between">
                      <span className="text-ink-muted">Budgets over cap</span>
                      <span className="tabular font-medium text-ink">{recommendations.budgetHealth.overCount}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-ink-muted">Close to the cap</span>
                      <span className="tabular font-medium text-ink">{recommendations.budgetHealth.nearCount}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-ink-muted">Unbudgeted spending</span>
                      <span className="tabular font-medium text-ink">{formatMoney(recommendations.budgetHealth.unbudgetedSpend, symbol, { decimals: 0 })}</span>
                    </li>
                  </ul>
                </>
              )}
            </Card>
          </div>

          {/* ── Monthly insight ───────────────────────────────────── */}
          {insight ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-500/12 text-brand-500">
                    <Brain className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {insight.title}
                      <Badge tone={insight.source === 'ai' ? 'info' : 'neutral'}>
                        {insight.source === 'ai' ? 'AI written' : 'analytics'}
                      </Badge>
                    </p>
                    <p className="text-2xs text-ink-soft">
                      {new Date(insight.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · generated{' '}
                      {formatRelative(insight.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Bookmark}
                    aria-label={insight.bookmarked ? 'Remove bookmark' : 'Bookmark insight'}
                    className={insight.bookmarked ? 'text-brand-500' : ''}
                    onClick={() => insightAction.run({ id: insight.id || insight._id, action: 'bookmark' })}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Copy}
                    aria-label="Copy insight text"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${insight.title}\n\n${insight.summaryText}\n\n${insight.tipText || ''}`);
                      toast.info('Insight copied to clipboard');
                    }}
                  />
                  {insight.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={X}
                      aria-label="Dismiss insight"
                      onClick={() => insightAction.run({ id: insight.id || insight._id, action: 'dismissed' })}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={RotateCcw}
                      aria-label="Restore insight"
                      onClick={() => insightAction.run({ id: insight.id || insight._id, action: 'active' })}
                    />
                  )}
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-ink-muted">{insight.summaryText}</p>
              {insight.tipText && (
                <p className="mt-3 flex items-start gap-2 rounded-2xl border border-brand-500/25 bg-brand-500/[.06] p-3.5 text-xs leading-relaxed text-ink">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  {insight.tipText}
                </p>
              )}

              {insight.highlights?.length > 0 && (
                <ul className="mt-3.5 flex flex-wrap gap-2">
                  {insight.highlights.map((highlight) => (
                    <li key={highlight} className="cc-badge-neutral normal-case">{highlight}</li>
                  ))}
                </ul>
              )}

              <div className="mt-4 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-4">
                {[
                  { label: 'Income', value: formatMoney(insight.metrics?.totalIncome || 0, symbol, { decimals: 0 }), tone: 'text-mint-600 dark:text-mint-400' },
                  { label: 'Expenses', value: formatMoney(insight.metrics?.totalExpense || 0, symbol, { decimals: 0 }), tone: 'text-rose-600 dark:text-rose-400' },
                  { label: 'Net', value: formatMoney(insight.metrics?.netSavings || 0, symbol, { decimals: 0 }), tone: (insight.metrics?.netSavings || 0) >= 0 ? 'text-mint-600 dark:text-mint-400' : 'text-rose-600 dark:text-rose-400' },
                  { label: 'Transactions', value: insight.metrics?.transactionCount || 0, tone: 'text-ink' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xs uppercase tracking-wide text-ink-soft">{stat.label}</p>
                    <p className={`mt-0.5 font-display text-base font-bold tabular ${stat.tone}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={Sparkles}
                title="No insight for this month yet"
                description="Insights are generated from your logged transactions. Add a few entries, then generate one."
                actionLabel="Generate now"
                onAction={regenerate}
              />
            </Card>
          )}

          {/* ── Tips ─────────────────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader
              title="Saving tips"
              subtitle={`${activeTips.length} tip(s) from ${tipsData?.monthLabel || 'this month'} · ranked by estimated impact`}
              icon={Lightbulb}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    ariaLabel="Filter tips"
                    size="sm"
                    value={tipTab}
                    onChange={setTipTab}
                    options={[
                      { value: 'active', label: 'Ranked' },
                      { value: 'high', label: 'Biggest' },
                      { value: 'bookmarked', label: 'Saved' },
                      { value: 'all', label: 'All' },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDismissed((value) => !value)}
                    className="text-2xs text-ink-muted underline-offset-2 hover:text-brand-500 hover:underline"
                  >
                    {showDismissed ? 'Hide dismissed' : 'Show dismissed'}
                  </button>
                </div>
              }
            />

            {filteredTips.length === 0 ? (
              <EmptyState
                compact
                icon={Lightbulb}
                title="No tips in this view"
                description="Tips are generated from real spending patterns — switch tabs, or regenerate after logging more transactions."
              />
            ) : (
              <ul className="space-y-3">
                {filteredTips.map((tip) => {
                  const meta = SEVERITY_META[tip.severity] || SEVERITY_META.info;
                  return (
                    <li
                      key={tip.id || tip._id}
                      className={`rounded-2xl border p-4 transition ${
                        tip.pinned ? 'border-brand-500/40 bg-brand-500/[.05]' : tip.dismissed ? 'border-surface-border bg-surface-muted opacity-70' : 'border-surface-border bg-surface'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                            {tip.pinned && <Pin className="h-3.5 w-3.5 text-brand-500" aria-label="Pinned" />}
                            {tip.title}
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {tip.categoryName && <span className="cc-badge-neutral normal-case">{tip.categoryName}</span>}
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{tip.body}</p>
                        </div>
                        {tip.potentialSaving > 0 && (
                          <div className="shrink-0 rounded-2xl border border-mint-500/30 bg-mint-500/[.08] px-3 py-2 text-center">
                            <p className="text-2xs uppercase tracking-wide text-ink-soft">Impact</p>
                            <p className="font-display text-base font-bold tabular text-mint-700 dark:text-mint-400">
                              {formatMoney(tip.potentialSaving, symbol, { decimals: 0 })}
                            </p>
                            <p className="text-2xs text-ink-soft">per month</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        {tip.actionHref && (
                          <Link to={tip.actionHref} className="cc-btn-secondary cc-btn-sm">
                            <Zap className="h-3.5 w-3.5" />
                            {tip.actionLabel || 'Take action'}
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pin}
                          className={tip.pinned ? 'text-brand-500' : ''}
                          onClick={() => tipAction.run({ id: tip.id || tip._id, action: 'pin' })}
                        >
                          {tip.pinned ? 'Unpin' : 'Pin'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Bookmark}
                          className={tip.bookmarked ? 'text-brand-500' : ''}
                          onClick={() => tipAction.run({ id: tip.id || tip._id, action: 'bookmark' })}
                        >
                          {tip.bookmarked ? 'Saved' : 'Save'}
                        </Button>
                        {tip.dismissed ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={RotateCcw}
                            onClick={() => tipAction.run({ id: tip.id || tip._id, action: 'restore' })}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={X}
                            className="ml-auto"
                            onClick={() => tipAction.run({ id: tip.id || tip._id, action: 'dismiss' })}
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ── Smart detection ──────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card className="p-5">
              <CardHeader
                title="Smart detection"
                subtitle="Large transactions, possible duplicates and accelerating categories"
                icon={AlertTriangle}
              />
              {!detection ? (
                <SkeletonCard rows={3} />
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-soft">Unusually large</p>
                    {detection.anomalies.length === 0 ? (
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-mint-700 dark:text-mint-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Nothing unusual in your recent transactions.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {detection.anomalies.slice(0, 4).map((anomaly) => (
                          <li key={anomaly.id} className="rounded-xl border border-amber-500/30 bg-amber-500/[.06] p-3">
                            <p className="flex items-center justify-between gap-2 text-xs font-semibold text-ink">
                              <span className="truncate">{anomaly.description || anomaly.categoryName}</span>
                              <span className="tabular shrink-0">{formatMoney(anomaly.amount, symbol)}</span>
                            </p>
                            <p className="mt-1 text-2xs leading-relaxed text-ink-muted">{anomaly.reason}</p>
                            <p className="mt-1 text-2xs text-ink-soft">
                              {new Date(anomaly.date).toLocaleDateString('en-GB')} · {anomaly.categoryName}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-soft">Possible duplicates</p>
                    {detection.duplicateGroups.length === 0 ? (
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-mint-700 dark:text-mint-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> No matching amount+date pairs in the last 60 days.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {detection.duplicateGroups.slice(0, 3).map((group, index) => {
                          const rows = group.transactions || group.items || [];
                          const first = rows[0] || group;
                          return (
                            <li key={`${first.amount}-${first.date}-${index}`} className="rounded-xl border border-surface-border bg-surface-muted p-3 text-xs">
                              <p className="font-semibold text-ink">
                                {rows.length || group.count || 2} × {formatMoney(first.amount, symbol)} on{' '}
                                {new Date(first.date).toLocaleDateString('en-GB')}
                              </p>
                              {rows.length > 0 && (
                                <p className="mt-0.5 text-2xs text-ink-soft">
                                  {rows.map((row) => row.description || row.category?.name || 'entry').join(' · ')}
                                </p>
                              )}
                              <Link
                                to={`/transactions?search=${encodeURIComponent(first.description || '')}&from=${new Date(first.date).toISOString().slice(0, 10)}`}
                                className="cc-link mt-1 inline-block text-2xs"
                              >
                                Review these entries
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-soft">Accelerating categories</p>
                    {detection.acceleratingCategories.length === 0 ? (
                      <p className="mt-1.5 text-xs text-ink-soft">No category is trending more than 25% above your average.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {detection.acceleratingCategories.map((row) => (
                          <li key={row.categoryId || row.categoryName} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-muted p-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-ink">{row.categoryName}</p>
                              <p className="text-2xs text-ink-soft">
                                {formatMoney(row.current, symbol)} this month vs {formatMoney(row.average, symbol)} average
                              </p>
                            </div>
                            <span className="shrink-0 tabular text-xs font-semibold text-rose-500">+{Math.round(row.changePercent)}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <div className="space-y-5">
              <Card className="p-5">
                <CardHeader title="Categorisation accuracy" subtitle="Last 90 days of suggestions" icon={Target} />
                <p className="font-display text-2xl font-bold text-ink">
                  {accuracy?.categorization?.accuracy ?? 0}%
                  <span className="ml-2 text-xs font-medium text-ink-muted">
                    {accuracy?.categorization?.accepted || 0} of {accuracy?.categorization?.total || 0} accepted
                  </span>
                </p>
                <ProgressBar value={accuracy?.categorization?.accuracy || 0} tone="brand" height="h-2" className="mt-3" />
                <ul className="mt-3.5 space-y-2">
                  {(accuracy?.categorization?.bySource || []).map((row) => (
                    <li key={row.source} className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted capitalize">{row.source === 'ai' ? 'AI model' : row.source === 'history' ? 'Your history' : 'Keyword rules'}</span>
                      <span className="tabular font-medium text-ink">
                        {row.accepted}/{row.count} accepted
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-2xs leading-relaxed text-ink-soft">
                  Every correction you make is stored and reused, so accuracy improves the more you log.
                </p>
              </Card>

              {detection?.forecast && (
                <Card className="p-5">
                  <CardHeader title="Next month forecast" subtitle={`Based on ${detection.forecast.basedOnMonths} months · ${detection.forecast.confidence} confidence`} icon={TrendingUp} />
                  <ul className="space-y-2.5 text-sm">
                    <li className="flex items-center justify-between">
                      <span className="text-ink-muted">Expected expenses</span>
                      <span className="tabular font-semibold text-ink">{formatMoney(detection.forecast.forecastExpense, symbol, { decimals: 0 })}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-ink-muted">Expected income</span>
                      <span className="tabular font-semibold text-mint-600 dark:text-mint-400">{formatMoney(detection.forecast.forecastIncome, symbol, { decimals: 0 })}</span>
                    </li>
                    <li className="flex items-center justify-between border-t border-surface-border pt-2.5">
                      <span className="text-ink-muted">Projected net</span>
                      <span className={`tabular font-semibold ${detection.forecast.forecastNet >= 0 ? 'text-mint-600 dark:text-mint-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatMoney(detection.forecast.forecastNet, symbol, { decimals: 0 })}
                      </span>
                    </li>
                  </ul>
                  <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-ink-soft">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    A projection, not a promise — it uses your own month-to-month averages and ignores one-off purchases.
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* ── Insight history ──────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader title="Insight archive" subtitle="Stored monthly analyses — dismiss or revisit any of them" icon={Sparkles} />
            {!insightHistory?.insights?.length ? (
              <p className="text-xs text-ink-soft">No stored insights yet.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {insightHistory.insights.map((item) => (
                  <li key={item._id || item.id} className="rounded-2xl border border-surface-border bg-surface-muted p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 text-2xs text-ink-soft">
                          {new Date(item.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} ·{' '}
                          {item.source === 'ai' ? 'AI written' : 'analytics'}
                          {item.status === 'dismissed' && ' · dismissed'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          icon={Bookmark}
                          className={item.bookmarked ? 'text-brand-500' : ''}
                          aria-label="Bookmark insight"
                          onClick={() => insightAction.run({ id: item._id || item.id, action: 'bookmark' })}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          icon={item.status === 'active' ? X : RotateCcw}
                          aria-label={item.status === 'active' ? 'Dismiss insight' : 'Restore insight'}
                          onClick={() => insightAction.run({ id: item._id || item.id, action: item.status === 'active' ? 'dismissed' : 'active' })}
                        />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 text-2xs leading-relaxed text-ink-muted">{item.summaryText}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Category mix ─────────────────────────────────────── */}
          {tips.length > 0 && (
            <Card className="p-5">
              <CardHeader title="Where the tips come from" subtitle="Your biggest categories are where the savings are" icon={Target} />
              <CategoryDonutChart
                data={Object.values(
                  tips.reduce((acc, tip) => {
                    if (!tip.categoryName) return acc;
                    acc[tip.categoryName] = acc[tip.categoryName] || { name: tip.categoryName, value: 0 };
                    acc[tip.categoryName].value += tip.potentialSaving || 0;
                    return acc;
                  }, {}),
                )
                  .filter((entry) => entry.value > 0)
                  .sort((a, b) => b.value - a.value)
                  .map((entry, index) => ({
                    ...entry,
                    value: Math.round(entry.value * 100) / 100,
                    color: INSIGHT_PALETTE[index % INSIGHT_PALETTE.length],
                  }))}
                currency={symbol}
                height={240}
                centerLabel="Potential"
              />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
