import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChartEmpty, ChartTooltip, RoundedBar, useChartTheme } from './ChartBits';
import { formatMoney } from '../utils/format';

const axisProps = (theme) => ({
  stroke: theme.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tick: { fill: theme.axis },
});

/** Daily spending area chart for the current month. */
export function DailySpendChart({ data = [], currency = '$', height = 240 }) {
  const theme = useChartTheme();
  if (!data.length) return <ChartEmpty height={height} message="Log a few transactions to see your daily rhythm" />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.brand} stopOpacity={0.42} />
            <stop offset="100%" stopColor={theme.brand} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.income} stopOpacity={0.32} />
            <stop offset="100%" stopColor={theme.income} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={18} {...axisProps(theme)} />
        <YAxis {...axisProps(theme)} width={54} tickFormatter={(v) => formatMoney(v, currency, { decimals: 0, compact: true })} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: theme.brand, strokeOpacity: 0.25 }} />
        <Area type="monotone" dataKey="expense" name="Spent" stroke={theme.brand} strokeWidth={2.4} fill="url(#spendFill)" activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="income" name="Income" stroke={theme.income} strokeWidth={2} fill="url(#incomeFill)" strokeDasharray="5 4" activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Six-month income vs expense bars (SRS: last six months report). */
export function IncomeExpenseChart({ data = [], currency = '$', height = 260, showLegend = true }) {
  const theme = useChartTheme();
  if (!data.length) return <ChartEmpty height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={6}>
        <CartesianGrid strokeDasharray="4 6" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis {...axisProps(theme)} width={54} tickFormatter={(v) => formatMoney(v, currency, { decimals: 0, compact: true })} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: theme.grid, opacity: 0.35 }} />
        {showLegend && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: theme.axis, paddingTop: 8 }} />}
        <Bar dataKey="income" name="Income" fill={theme.income} shape={<RoundedBar />} maxBarSize={26} />
        <Bar dataKey="expense" name="Expenses" fill={theme.expense} shape={<RoundedBar />} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Category donut with the top slice called out in the centre. */
export function CategoryDonutChart({ data = [], currency = '$', height = 260, centerLabel = 'Spent' }) {
  const theme = useChartTheme();
  if (!data.length) return <ChartEmpty height={height} message="No expenses recorded this month" />;

  const total = data.reduce((sum, entry) => sum + (entry.value || 0), 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2.5}
            stroke="none"
            animationDuration={700}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color || theme.brand} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip currency={currency} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xs uppercase tracking-wide text-ink-soft">{centerLabel}</span>
        <span className="font-display text-xl font-bold tabular text-ink">{formatMoney(total, currency, { decimals: 0, compact: true })}</span>
        <span className="mt-0.5 text-2xs text-ink-soft">{data.length} categories</span>
      </div>
    </div>
  );
}

/** Budget vs actual horizontal bars. */
export function BudgetCompareChart({ data = [], currency = '$', height = 280 }) {
  const theme = useChartTheme();
  if (!data.length) return <ChartEmpty height={height} message="Set a monthly budget to compare" />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="4 6" stroke={theme.grid} horizontal={false} />
        <XAxis type="number" {...axisProps(theme)} tickFormatter={(v) => formatMoney(v, currency, { decimals: 0, compact: true })} />
        <YAxis type="category" dataKey="name" width={92} {...axisProps(theme)} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: theme.grid, opacity: 0.3 }} />
        <Bar dataKey="limit" name="Budget" fill={theme.grid} shape={<RoundedBar radius={5} />} maxBarSize={11} />
        <Bar dataKey="spent" name="Spent" shape={<RoundedBar radius={5} />} maxBarSize={11}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.status === 'over' ? theme.expense : entry.status === 'near' ? theme.amber : entry.color || theme.brand} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Weekly spending buckets. */
export function WeeklyBars({ data = [], currency = '$', height = 200 }) {
  const theme = useChartTheme();
  if (!data.length) return <ChartEmpty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 6" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis {...axisProps(theme)} width={50} tickFormatter={(v) => formatMoney(v, currency, { decimals: 0, compact: true })} />
        <Tooltip content={<ChartTooltip currency={currency} labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.range || ''}`} />} cursor={{ fill: theme.grid, opacity: 0.3 }} />
        <Bar dataKey="expense" name="Spent" fill={theme.accent} shape={<RoundedBar />} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Net savings line for the trend widget. */
export function NetTrendLine({ data = [], currency = '$', height = 200 }) {
  const theme = useChartTheme();
  if (!data.length) return <ChartEmpty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 6" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis {...axisProps(theme)} width={52} tickFormatter={(v) => formatMoney(v, currency, { decimals: 0, compact: true })} />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Line type="monotone" dataKey="net" name="Net saved" stroke={theme.brand} strokeWidth={2.6} dot={{ r: 3, fill: theme.brand }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Tiny inline sparkline for stat cards and lists. */
export function Sparkline({ data = [], dataKey = 'expense', color, height = 40 }) {
  const theme = useChartTheme();
  if (!data.length) return <div style={{ height }} />;
  const stroke = color || theme.brand;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={1.8} fill={`url(#spark-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { ChartEmpty };
