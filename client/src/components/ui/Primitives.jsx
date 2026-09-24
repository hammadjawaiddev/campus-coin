import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import CategoryIcon from './CategoryIcon';

/* ── Badges ─────────────────────────────────────────────────────────────── */

export function Badge({ children, tone = 'neutral', className = '', icon: Icon }) {
  const tones = {
    info: 'cc-badge-info',
    brand: 'cc-badge-info',
    success: 'cc-badge-success',
    warning: 'cc-badge-warning',
    danger: 'cc-badge-danger',
    neutral: 'cc-badge-neutral',
  };
  return (
    <span className={`${tones[tone] || tones.neutral} ${className}`}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */

export function Avatar({ name = '', color = '#6D5DFB', size = 'md', url, className = '' }) {
  const sizes = { xs: 'h-7 w-7 text-2xs', sm: 'h-9 w-9 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };
  const label = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  if (url) {
    return <img src={url} alt={name} className={`rounded-2xl object-cover ${sizes[size]} ${className}`} />;
  }

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl font-semibold text-white ${sizes[size]} ${className}`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

/* ── Progress ───────────────────────────────────────────────────────────── */

export function ProgressBar({ value = 0, tone = 'brand', barClass = '', height = 'h-2', label, showValue = false, className = '' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const tones = {
    brand: 'bg-brand-gradient',
    success: 'bg-mint-gradient',
    warning: 'bg-warn-gradient',
    danger: 'bg-danger-gradient',
  };

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="font-medium text-ink-muted">{label}</span>}
          {showValue && <span className="tabular font-semibold text-ink">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div className={`cc-progress ${height}`} role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={`cc-progress-bar ${barClass || tones[tone]}`}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: [0.22, 0.9, 0.32, 1] }}
        />
      </div>
    </div>
  );
}

/* ── Animated counter ───────────────────────────────────────────────────── */

/**
 * Counts up to `value` when scrolled into view. Respects reduced-motion by
 * jumping straight to the final number.
 */
export function AnimatedCounter({ value = 0, duration = 1.1, prefix = '', suffix = '', decimals = 2, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);
  const target = Number(value) || 0;

  useEffect(() => {
    if (!inView) return undefined;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, duration]);

  const formatted = Math.abs(display).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {display < 0 ? '−' : ''}
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* ── Category chip ──────────────────────────────────────────────────────── */

export function CategoryChip({ category, size = 'md', className = '', showName = true }) {
  if (!category) return null;
  const sizes = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11' };
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`grid ${sizes[size]} shrink-0 place-items-center rounded-xl`}
        style={{ backgroundColor: `${category.color}1F`, color: category.color }}
        aria-hidden="true"
      >
        <CategoryIcon name={category.icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </span>
      {showName && <span className="truncate text-sm font-medium text-ink">{category.name}</span>}
    </span>
  );
}

/* ── Toggle switch ──────────────────────────────────────────────────────── */

export function Toggle({ checked, onChange, label, description, disabled = false, id }) {
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-ink">
              {label}
            </label>
          )}
          {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>}
        </div>
      )}
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
          checked ? 'bg-brand-500' : 'bg-ink-soft/35'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/* ── Segmented control ──────────────────────────────────────────────────── */

export function Segmented({ options, value, onChange, size = 'md', className = '', ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex rounded-xl border border-surface-border bg-surface-muted p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={`relative rounded-lg font-medium transition-all duration-200 ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
            } ${active ? 'text-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${ariaLabel || 'default'}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-sm"
                transition={{ duration: 0.22, ease: [0.22, 0.9, 0.32, 1] }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.icon && <option.icon className="h-3.5 w-3.5" aria-hidden="true" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Section heading for marketing pages ────────────────────────────────── */

export function SectionHeading({ eyebrow, title, description, align = 'center', className = '' }) {
  return (
    <div className={`${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}>
      {eyebrow && (
        <span className="cc-badge-info mb-3 inline-flex">{eyebrow}</span>
      )}
      <h2 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {description && <p className="mt-3.5 text-pretty text-base leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}

/* ── Trend pill (▲ 12% vs last month) ───────────────────────────────────── */

export function TrendPill({ value, suffix = '% vs last month', invert = false, className = '', showZero = true }) {
  const change = Number(value);
  if (!Number.isFinite(change) || (change === 0 && !showZero)) return null;
  const positive = change > 0;
  const good = invert ? !positive : positive;
  const tone = change === 0 ? 'text-ink-muted bg-ink-soft/12' : good ? 'text-mint-600 dark:text-mint-400 bg-mint-500/12' : 'text-rose-600 dark:text-rose-400 bg-rose-500/12';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold tabular ${tone} ${className}`}>
      {positive ? '▲' : change < 0 ? '▼' : '■'} {Math.abs(Math.round(change))}
      {suffix}
    </span>
  );
}
