import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark, FileText, Layers, Lightbulb, Search, Sparkles, Star, Trash2,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Badge, Segmented } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback.jsx';
import { bookmarkApi } from '../services/endpoints.js';
import { useApi, useApiAction, useDebounced } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney, formatRelative } from '../utils/format.js';

const TYPE_META = {
  tip: { label: 'Saving tip', icon: Lightbulb, tone: 'info', href: '/insights' },
  insight: { label: 'Monthly insight', icon: Sparkles, tone: 'brand', href: '/insights' },
  report: { label: 'Report snapshot', icon: FileText, tone: 'warning', href: '/reports' },
};

export default function Bookmarks() {
  const { user } = useAuth();
  const toast = useToast();
  const symbol = currencySymbol(user?.preferences?.currency);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 250);

  const { data, isLoading, error, reload, refresh } = useApi(() => bookmarkApi.list(), { deps: [] });

  const removeAction = useApiAction((id) => bookmarkApi.remove(id), {
    onSuccess: () => {
      toast.success('Bookmark removed');
      refresh();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not remove that bookmark'),
  });

  const bookmarks = data?.bookmarks || [];
  const counts = data?.counts || { total: 0 };

  const visible = useMemo(() => {
    const base = filter === 'all' ? bookmarks : bookmarks.filter((item) => item.itemType === filter);
    if (!debouncedSearch.trim()) return base;
    const needle = debouncedSearch.trim().toLowerCase();
    return base.filter(
      (item) => item.title?.toLowerCase().includes(needle) || item.body?.toLowerCase().includes(needle),
    );
  }, [bookmarks, filter, debouncedSearch]);

  return (
    <>
      <PageHeader
        title="Bookmarks"
        description="Everything you starred while exploring — saving tips, monthly insights and report snapshots in one place."
        crumbs={[{ label: 'Bookmarks' }]}
        icon={Bookmark}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total saved', value: counts.total || 0, icon: Bookmark },
          { label: 'Saving tips', value: counts.tip || 0, icon: Lightbulb },
          { label: 'Insights', value: counts.insight || 0, icon: Sparkles },
          { label: 'Report snapshots', value: counts.report || 0, icon: FileText },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-3 p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/12 text-brand-500">
              <stat.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-2xs uppercase tracking-wide text-ink-soft">{stat.label}</p>
              <p className="font-display text-lg font-bold tabular text-ink">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            ariaLabel="Filter bookmarks"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', icon: Layers },
              { value: 'tip', label: 'Tips' },
              { value: 'insight', label: 'Insights' },
              { value: 'report', label: 'Reports' },
            ]}
          />
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your bookmarks…"
              className="cc-input pl-10"
              aria-label="Search bookmarks"
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}
        </div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Star}
            title={bookmarks.length === 0 ? 'Nothing bookmarked yet' : 'No bookmarks match that filter'}
            description={
              bookmarks.length === 0
                ? 'Star a saving tip on the insights page, or save a report snapshot, and it will appear here for quick reference.'
                : 'Try a different type or clear the search box.'
            }
            actionLabel={bookmarks.length === 0 ? 'Browse insights' : 'Clear filters'}
            onAction={bookmarks.length === 0 ? undefined : () => { setFilter('all'); setSearch(''); }}
            secondaryAction={
              bookmarks.length === 0 ? <Link to="/insights" className="cc-btn-primary">Browse insights</Link> : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((bookmark) => {
            const meta = TYPE_META[bookmark.itemType] || TYPE_META.tip;
            const potential = bookmark.meta?.potentialSaving;
            return (
              <Card key={bookmark._id || bookmark.id} hover className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/12 text-brand-500">
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {bookmark.title || 'Saved item'}
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-muted">{bookmark.body}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-soft">
                  <span>Saved {formatRelative(bookmark.createdAt)}</span>
                  {potential ? <span>Potential {formatMoney(potential, symbol, { decimals: 0 })}/month</span> : null}
                  {bookmark.meta?.month && (
                    <span>Period {new Date(bookmark.meta.month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                  )}
                  {bookmark.meta?.source && <span className="capitalize">{bookmark.meta.source}</span>}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-4">
                  <Link to={meta.href} className="cc-btn-secondary cc-btn-sm">
                    Open {bookmark.itemType === 'report' ? 'reports' : 'insights'}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-rose-500"
                    icon={Trash2}
                    loading={removeAction.isRunning}
                    onClick={() => removeAction.run(bookmark._id || bookmark.id)}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
