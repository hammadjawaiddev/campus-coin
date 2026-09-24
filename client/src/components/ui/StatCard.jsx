import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedCounter } from './Primitives';

/**
 * Headline metric card used across the dashboard.
 * `invert` flips the colour logic for metrics where "up" is bad (spending).
 */
export default function StatCard({
  label,
  value,
  prefix = '$',
  change,
  changeSuffix = '% vs last month',
  invert = false,
  icon: Icon,
  tone = 'brand',
  hint,
  decimals = 2,
  animate = true,
  size = 'md',
  footer,
  className = '',
}) {
  const tones = {
    brand: { chip: 'bg-brand-500/12 text-brand-500 dark:text-brand-300', glow: 'from-brand-500/12' },
    success: { chip: 'bg-mint-500/14 text-mint-600 dark:text-mint-400', glow: 'from-mint-500/14' },
    warning: { chip: 'bg-amber-500/14 text-amber-600 dark:text-amber-400', glow: 'from-amber-500/14' },
    danger: { chip: 'bg-rose-500/14 text-rose-600 dark:text-rose-400', glow: 'from-rose-500/14' },
    neutral: { chip: 'bg-ink-soft/12 text-ink-muted', glow: 'from-ink-soft/10' },
  };
  const palette = tones[tone] || tones.brand;

  const hasChange = Number.isFinite(Number(change)) && change !== null;
  const positive = Number(change) > 0;
  const good = invert ? !positive : positive;
  const TrendIcon = !hasChange || Number(change) === 0 ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  const trendTone = !hasChange || Number(change) === 0
    ? 'text-ink-soft'
    : good
      ? 'text-mint-600 dark:text-mint-400'
      : 'text-rose-600 dark:text-rose-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 0.9, 0.32, 1] }}
      className={`cc-card cc-card-hover relative overflow-hidden ${size === 'lg' ? 'p-5' : 'p-4'} ${className}`}
    >
      <div className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${palette.glow} to-transparent blur-2xl`} aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
        {Icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${palette.chip}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <p className={`relative mt-2.5 font-display font-bold tracking-tight text-ink ${size === 'lg' ? 'text-3xl' : 'text-2xl'}`}>
        {animate ? <AnimatedCounter value={value} prefix={prefix} decimals={decimals} /> : `${prefix}${Number(value || 0).toFixed(decimals)}`}
      </p>

      {(hasChange || hint || footer) && (
        <div className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {hasChange && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular ${trendTone}`}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {Math.abs(Math.round(Number(change)))}%
            </span>
          )}
          {hasChange && <span className="text-xs text-ink-soft">{changeSuffix}</span>}
          {hint && <span className="text-xs text-ink-muted">{hint}</span>}
        </div>
      )}

      {footer && <div className="relative mt-3">{footer}</div>}
    </motion.div>
  );
}
