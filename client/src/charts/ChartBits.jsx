import { useTheme } from '../context/ThemeContext';
import { formatMoney } from '../utils/format';

/**
 * Shared Recharts theming.
 * Chart colours come from CSS variables so dark mode stays readable without
 * re-rendering charts with new props.
 */
export function useChartTheme() {
  const { isDark } = useTheme();
  return {
    grid: isDark ? 'rgba(148,163,184,.16)' : 'rgba(100,116,139,.16)',
    axis: isDark ? '#8194B0' : '#7C8AA5',
    tooltipBg: isDark ? 'rgba(20,27,54,.96)' : 'rgba(255,255,255,.98)',
    tooltipBorder: isDark ? 'rgba(64,80,120,.7)' : 'rgba(226,230,240,1)',
    tooltipText: isDark ? '#E8EEF9' : '#0F172A',
    income: isDark ? '#34D399' : '#16A34A',
    expense: isDark ? '#FB7185' : '#E11D48',
    brand: '#6D5DFB',
    accent: '#22D3EE',
    amber: '#F59E0B',
    isDark,
  };
}

/** Themed tooltip used by every chart. */
export function ChartTooltip({ active, payload, label, currency = '$', formatter, labelFormatter }) {
  const theme = useChartTheme();
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-lift backdrop-blur-md"
      style={{ background: theme.tooltipBg, borderColor: theme.tooltipBorder, color: theme.tooltipText }}
    >
      <p className="mb-1 font-semibold">{labelFormatter ? labelFormatter(label, payload) : label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 opacity-85">
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.payload?.color || theme.brand }} />
              {entry.name}
            </span>
            <span className="tabular font-semibold">
              {formatter ? formatter(entry.value, entry.name) : formatMoney(entry.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rounded, animated bar shape used by the income/expense chart. */
export function RoundedBar({ x, y, width, height, fill, radius = 6 }) {
  const safeHeight = Math.max(0, height);
  const r = Math.min(radius, width / 2, safeHeight / 2 || radius);
  return (
    <rect x={x} y={y} width={width} height={safeHeight} rx={r} ry={r} fill={fill} />
  );
}

/** Empty-chart placeholder keeps layouts stable when a period has no data. */
export function ChartEmpty({ height = 240, message = 'No data for this period yet' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height }}>
      <div className="flex h-10 items-end gap-1.5" aria-hidden="true">
        {[30, 55, 22, 68, 40].map((h, i) => (
          <span key={i} className="w-3 rounded-t bg-ink-soft/25" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="text-xs text-ink-soft">{message}</p>
    </div>
  );
}
