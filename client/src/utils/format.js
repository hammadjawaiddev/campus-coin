/** Shared formatting helpers used across the app. */

export const CURRENCY_SYMBOLS = {
  USD: '$', PKR: 'Rs', INR: '₹', EUR: '€', GBP: '£', AED: 'AED', SAR: 'SAR', BDT: '৳',
};

export const currencySymbol = (code = 'USD') => CURRENCY_SYMBOLS[code] || '$';

/** Compact money for cards: keeps decimals only when they matter. */
export const formatMoney = (value, symbol = '$', { decimals = 2, compact = false } = {}) => {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  if (compact && abs >= 10000) {
    return `${amount < 0 ? '-' : ''}${symbol}${(abs / 1000).toFixed(abs >= 100000 ? 0 : 1)}k`;
  }
  return `${amount < 0 ? '-' : ''}${symbol}${abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const formatSignedMoney = (value, symbol = '$', options) =>
  `${Number(value) > 0 ? '+' : Number(value) < 0 ? '−' : ''}${formatMoney(Math.abs(Number(value) || 0), symbol, options)}`;

export const formatNumber = (value, options = {}) =>
  (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2, ...options });

export const formatPercent = (value, decimals = 0) => `${Number(value) > 0 ? '+' : ''}${(Number(value) || 0).toFixed(decimals)}%`;

export const formatDate = (value, style = 'medium') => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options = {
    short: { day: '2-digit', month: 'short' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    month: { month: 'long', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  }[style] || { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
};

/** "3 days ago" / "in 2 weeks" — used by notifications and activity feeds. */
export const formatRelative = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (Math.abs(days) < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
};

export const toDateInput = (value = new Date()) => {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

export const monthKey = (value = new Date()) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (value = new Date(), style = 'long') => {
  const d = new Date(value);
  if (style === 'short') return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Working late';
};

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export const pluralise = (count, singular, plural) => `${count} ${count === 1 ? singular : plural || `${singular}s`}`;

export const budgetStatusMeta = (status) => ({
  safe: { label: 'On track', tone: 'success', bar: 'bg-mint-gradient', text: 'text-mint-600 dark:text-mint-400' },
  near: { label: 'Near limit', tone: 'warning', bar: 'bg-warn-gradient', text: 'text-amber-600 dark:text-amber-400' },
  over: { label: 'Over budget', tone: 'danger', bar: 'bg-danger-gradient', text: 'text-rose-600 dark:text-rose-400' },
}[status] || { label: 'No budget', tone: 'neutral', bar: 'bg-ink-soft/40', text: 'text-ink-muted' });

export const severityMeta = (severity) => ({
  success: { tone: 'success', icon: 'CheckCircle2', ring: 'ring-mint-500/25' },
  warning: { tone: 'warning', icon: 'AlertTriangle', ring: 'ring-amber-500/25' },
  danger: { tone: 'danger', icon: 'AlertOctagon', ring: 'ring-rose-500/25' },
  info: { tone: 'info', icon: 'Info', ring: 'ring-brand-500/25' },
}[severity] || { tone: 'info', icon: 'Info', ring: 'ring-brand-500/25' });

export const truncate = (text = '', length = 80) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;
