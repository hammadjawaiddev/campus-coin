import { Link } from 'react-router-dom';

/**
 * The Campus Coin mark: a coin with an upward trend notch.
 * Inline SVG so it renders in the sandboxed preview (no external assets).
 */
export function LogoMark({ size = 36, className = '', animated = false }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-2xl bg-brand-gradient shadow-[0_10px_30px_-14px_rgba(109,93,251,.95)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} fill="none">
        <circle cx="16" cy="16" r="11.2" stroke="white" strokeWidth="2.4" opacity="0.95" />
        <path
          d="M8.6 18.4l4.2-4.6 3.1 2.9 7-7.4"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M19.4 9.3h4.3v4.3" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {animated && <circle cx="16" cy="16" r="13.4" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" className="animate-pulse-ring" />}
      </svg>
    </span>
  );
}

export function Logo({ size = 36, to = '/', showTagline = false, className = '', subtitleClassName = '' }) {
  const content = (
    <>
      <LogoMark size={size} />
      <span className="min-w-0">
        <span className="block font-display text-[17px] font-bold leading-tight tracking-tight text-ink">Campus Coin</span>
        <span className={`block text-2xs font-medium leading-tight text-ink-soft ${subtitleClassName || (showTagline ? '' : 'sr-only')}`}>
          Smart Spending, Student Style
        </span>
      </span>
    </>
  );

  if (!to) return <span className={`inline-flex items-center gap-2.5 ${className}`}>{content}</span>;

  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Campus Coin — home">
      {content}
    </Link>
  );
}

/** Small helper for the dashboard header's "coin balance" chip. */
export function CoinChip({ label, value, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-muted px-3 py-1.5 text-xs ${className}`}>
      <span className="h-2 w-2 rounded-full bg-brand-gradient" aria-hidden="true" />
      <span className="text-ink-muted">{label}</span>
      <span className="tabular font-semibold text-ink">{value}</span>
    </span>
  );
}

export default Logo;
