import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import Button from './Button';

/* ── Skeletons ──────────────────────────────────────────────────────────── */

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`cc-skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonCard({ rows = 3, className = '' }) {
  return (
    <div className={`cc-card p-5 ${className}`} aria-busy="true" aria-label="Loading">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="cc-card p-4">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-6 w-24" />
          <Skeleton className="mt-2.5 h-2.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ className = 'h-64' }) {
  return (
    <div className={`cc-card p-5 ${className}`} aria-busy="true">
      <Skeleton className="h-3.5 w-40" />
      <div className="mt-6 flex h-[70%] items-end gap-2">
        {[45, 70, 35, 85, 55, 75, 40, 65].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Empty & error states ───────────────────────────────────────────────── */

/**
 * Illustrated empty state. `tone` switches the accent so success/celebration
 * states (e.g. "all budgets on track") feel different from a cold start.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  actionLabel,
  onAction,
  tone = 'neutral',
  compact = false,
  className = '',
}) {
  const tones = {
    neutral: 'from-brand-500/14 to-accent-400/10 text-brand-500',
    success: 'from-mint-500/18 to-accent-400/10 text-mint-500',
    warning: 'from-amber-500/18 to-brand-500/10 text-amber-500',
  };
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'} ${className}`}>
      <div className={`relative mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br ${tones[tone] || tones.neutral}`}>
        <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
        <span className="absolute -inset-2 -z-10 rounded-[28px] bg-brand-500/5 blur-xl" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>}
      {onAction && (
        <Button className="mt-5" onClick={onAction} variant={tone === 'warning' ? 'secondary' : 'primary'}>
          {actionLabel || 'Get started'}
        </Button>
      )}
      {action}
    </div>
  );
}

/** Inline error with a retry affordance — used when a widget fails to load. */
export function ErrorState({ error, onRetry, title = 'We could not load this', compact = false }) {
  const offline = error?.isNetworkError || error?.status === 0;
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-12'}`}>
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/12 text-rose-500">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-ink">{offline ? 'Cannot reach the server' : title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{error?.message || 'Please try again in a moment.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Offline banner shown app-wide when the browser drops its connection. */
export function OfflineBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
      <WifiOff className="h-3.5 w-3.5" />
      You are offline — changes will not be saved until the connection returns.
    </div>
  );
}
