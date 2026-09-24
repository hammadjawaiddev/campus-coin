import { Link } from 'react-router-dom';
import {
  Activity, BarChart3, BellRing, Database, Layers, Megaphone, RefreshCw, Server, Sparkles, Tag, TrendingUp,
  UserCheck, UserPlus, Users, Wallet, Zap,
} from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Avatar, Badge } from '../../components/ui/Primitives.jsx';
import { ErrorState, SkeletonCard, SkeletonStats } from '../../components/ui/Feedback.jsx';
import { IncomeExpenseChart, NetTrendLine } from '../../charts/index.jsx';
import { useApi, useApiAction } from '../../hooks/useApi.js';
import { adminApi } from '../../services/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatMoney, formatRelative } from '../../utils/format.js';

export default function AdminDashboard() {
  const toast = useToast();
  const { data, isLoading, error, reload, refresh, isRefreshing } = useApi(() => adminApi.dashboard(), { deps: [] });

  const recompute = useApiAction(() => adminApi.recomputeInsights({ force: true }), {
    onSuccess: (response) => {
      toast.success(response.message || 'Insights recomputed for all students', {
        description: response.data
          ? `${response.data.generated ?? 0} insights regenerated for ${response.data.students ?? 0} students`
          : undefined,
      });
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not recompute insights'),
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Admin overview" />
        <div className="space-y-5">
          <SkeletonStats count={4} />
          <SkeletonCard rows={5} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Admin overview" />
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      </>
    );
  }

  const totals = data.totals;
  // Platform totals aggregate every student's own currency, so no symbol is
  // applied here — the per-user detail view shows their chosen currency.
  const currency = '';
  const topCategories = data.mostUsedCategories.map((row, index) => ({
    ...row,
    color: row.color || ['#F97316', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6'][index % 5],
  }));

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Aggregate, anonymous-safe totals across every student account on this deployment."
        crumbs={[{ label: 'Overview' }]}
        icon={Layers}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={() => refresh()}>Refresh</Button>
            <Button size="sm" icon={Sparkles} loading={recompute.isRunning} onClick={() => recompute.run()}>
              Recompute insights
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Students', value: totals.users, hint: `${totals.activeUsers} active · ${totals.disabledUsers} disabled`, icon: Users },
          { label: 'New this month', value: totals.newUsers30, hint: `${totals.newUsers7} in the last 7 days`, icon: UserPlus },
          { label: 'Transactions', value: totals.transactions, hint: `${totals.transactionsThisMonth} this month`, icon: Activity },
          { label: 'Platform net', value: formatMoney(totals.net, currency, { decimals: 0 }), hint: `${formatMoney(totals.expense, currency, { decimals: 0 })} spent · ${formatMoney(totals.income, currency, { decimals: 0 })} in`, icon: Wallet },
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
          <CardHeader title="Transaction volume" subtitle="Income versus expenses, platform-wide" icon={TrendingUp} />
          <IncomeExpenseChart data={data.transactionVolume} currency={currency} height={250} />
        </Card>

        <Card className="p-5">
          <CardHeader title="User growth" subtitle="Accounts created per month" icon={UserPlus} />
          <NetTrendLine data={data.userGrowth.map((row) => ({ ...row, net: row.users }))} currency={currency} height={250} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Most used categories" subtitle="Across every student account" icon={Tag} />
          <ul className="space-y-3">
            {topCategories.map((row) => {
              const max = Math.max(...topCategories.map((entry) => entry.count), 1);
              return (
                <li key={row.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-ink">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} aria-hidden="true" />
                      {row.name}
                    </span>
                    <span className="tabular text-ink-muted">
                      {row.count} entries · {formatMoney(row.total, currency, { decimals: 0 })}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-soft/12">
                    <div className="h-full rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: row.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <CardHeader title="Engagement" subtitle="How students use the platform" icon={Activity} />
          <ul className="space-y-3 text-sm">
            {[
              { label: 'Total logins', value: data.engagement.totalLogins },
              { label: 'Avg logins / user', value: data.engagement.averageLoginsPerUser },
              { label: 'Avg transactions / user', value: Math.round(data.engagement.averageTransactionsPerUser) },
              { label: 'Categorisation accuracy', value: `${data.engagement.categorizationAccuracy}%` },
              { label: 'Stored insights', value: totals.insights },
              { label: 'Active tips', value: totals.activeTips },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between border-b border-surface-border pb-2 last:border-0 last:pb-0">
                <span className="text-xs text-ink-muted">{row.label}</span>
                <span className="tabular font-semibold text-ink">{row.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <CardHeader
            title="Recent sign-ups"
            subtitle={`${data.recentUsers.length} shown`}
            icon={UserCheck}
            action={<Link to="/admin/users" className="cc-link text-xs">Manage users</Link>}
          />
          <ul className="divide-y divide-surface-border">
            {data.recentUsers.map((user) => (
              <li key={user._id} className="flex items-center gap-3 py-3">
                <Avatar name={user.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                  <p className="truncate text-2xs text-ink-soft">{user.email} · {user.academicYear || 'year not set'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'active' : 'disabled'}</Badge>
                  <p className="mt-1 text-2xs text-ink-soft">
                    {user.lastLoginAt ? `last seen ${formatRelative(user.lastLoginAt)}` : 'never signed in'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Services" subtitle="Deployment configuration" icon={Server} />
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted"><Sparkles className="h-3.5 w-3.5" /> AI assistant</span>
                <Badge tone={data.services.ai.configured ? 'success' : 'neutral'}>
                  {data.services.ai.configured ? 'connected' : 'rule-based fallback'}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted"><BellRing className="h-3.5 w-3.5" /> Email delivery</span>
                <Badge tone={data.services.email.configured ? 'success' : 'neutral'}>
                  {data.services.email.configured ? 'configured' : 'not configured'}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted"><Database className="h-3.5 w-3.5" /> Database</span>
                <Badge tone="success">MongoDB</Badge>
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <CardHeader title="Quick actions" subtitle="Common admin tasks" icon={Zap} />
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/users" className="cc-btn-secondary cc-btn-sm"><Users className="h-3.5 w-3.5" /> Users</Link>
              <Link to="/admin/categories" className="cc-btn-secondary cc-btn-sm"><Tag className="h-3.5 w-3.5" /> Categories</Link>
              <Link to="/admin/announcements" className="cc-btn-secondary cc-btn-sm"><Megaphone className="h-3.5 w-3.5" /> Announce</Link>
              <Link to="/admin/analytics" className="cc-btn-secondary cc-btn-sm"><BarChart3 className="h-3.5 w-3.5" /> Analytics</Link>
            </div>
            <p className="mt-3 text-2xs leading-relaxed text-ink-soft">
              Every admin action is authorised on the server by JWT role — the front end can never grant itself access.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
