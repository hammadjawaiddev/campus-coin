import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, BarChart3, Bell, BookOpen, Bus, CalendarClock, ChevronDown, Clapperboard,
  CloudUpload, Coins, Compass, CreditCard, FileText, GraduationCap, Home as HomeIcon, Lightbulb,
  Lock, Moon, PieChart, Pin, Repeat, ShieldCheck, Sparkles, Target, TrendingUp, Users, UtensilsCrossed,
  Wallet, Wand2, Zap,
} from 'lucide-react';

import Button from '../components/ui/Button';
import { SectionHeading } from '../components/ui/Primitives';
import { CategoryDonutChart, IncomeExpenseChart, DailySpendChart, BudgetCompareChart } from '../charts/index.jsx';
import { formatMoney } from '../utils/format';
import SitemapTree from '../components/SitemapTree.jsx';

/* Demo figures used *only* in the marketing mockups below — labelled as a
   preview so it is never confused with the live, database-driven dashboard. */
const PREVIEW = {
  daily: [
    { label: '01', expense: 12.4, income: 0 }, { label: '04', expense: 26.8, income: 0 },
    { label: '07', expense: 8.2, income: 350 }, { label: '10', expense: 31.5, income: 0 },
    { label: '13', expense: 19.4, income: 0 }, { label: '16', expense: 42.1, income: 60 },
    { label: '19', expense: 15.6, income: 0 }, { label: '22', expense: 28.9, income: 0 },
    { label: '25', expense: 11.2, income: 45 }, { label: '28', expense: 34.7, income: 0 },
  ],
  trend: [
    { label: 'Apr', income: 420, expense: 388 }, { label: 'May', income: 455, expense: 402 },
    { label: 'Jun', income: 395, expense: 371 }, { label: 'Jul', income: 512, expense: 468 },
    { label: 'Aug', income: 448, expense: 419 }, { label: 'Sep', income: 476, expense: 392 },
  ],
  categories: [
    { name: 'Food', value: 138, color: '#F97316' }, { name: 'Transport', value: 62, color: '#0EA5E9' },
    { name: 'Hostel/Rent', value: 120, color: '#8B5CF6' }, { name: 'Academics', value: 48, color: '#6366F1' },
    { name: 'Subscriptions', value: 24, color: '#A855F7' }, { name: 'Entertainment', value: 41, color: '#EC4899' },
  ],
  budgets: [
    { name: 'Food', limit: 150, spent: 138, status: 'near', color: '#F97316' },
    { name: 'Transport', limit: 80, spent: 62, status: 'safe', color: '#0EA5E9' },
    { name: 'Entertainment', limit: 60, spent: 78, status: 'over', color: '#EC4899' },
    { name: 'Academics', limit: 70, spent: 48, status: 'safe', color: '#6366F1' },
  ],
};

const PROBLEMS = [
  { icon: UtensilsCrossed, title: 'Canteen & delivery', text: 'Small food spends, many times a month — the single biggest silent leak in a student budget.', tint: '#F97316' },
  { icon: Bus, title: 'Getting to campus', text: 'Metro cards, ride shares and fuel add up across the semester without ever feeling like "spending".', tint: '#0EA5E9' },
  { icon: HomeIcon, title: 'Hostel & bills', text: 'Rent, wifi, electricity and water splits are fixed but rarely tracked against a plan.', tint: '#8B5CF6' },
  { icon: Repeat, title: 'Forgotten subscriptions', text: 'Streaming, cloud storage and app plans renew quietly while your balance drops.', tint: '#A855F7' },
  { icon: BookOpen, title: 'Academics', text: 'Textbooks, printing, lab fees and course subscriptions hit hardest right before exams.', tint: '#6366F1' },
  { icon: Clapperboard, title: 'Social outings', text: 'Movies, trips and birthday treats are important — but unplanned, they wreck the month.', tint: '#EC4899' },
];

const FEATURES = [
  { icon: Zap, title: 'Quick-add logging', text: 'Income and expenses in seconds with student categories: allowance, shifts, canteen, hostel, printing.', tag: 'Core' },
  { icon: PieChart, title: 'Category intelligence', text: 'Donuts, bars and trends built from your real transactions — not sample data.', tag: 'Core' },
  { icon: BarChart3, title: 'Budgets that warn early', text: 'Per-category monthly caps with safe / near-limit / over states and in-app alerts at 80%.', tag: 'Core' },
  { icon: Target, title: 'Savings goals', text: 'Laptop funds, trip pots and emergency buffers with milestone celebrations.', tag: 'Core' },
  { icon: Wand2, title: 'AI categorisation', text: 'Suggests a category as you type. You stay in control: accept, change, and it learns from your fix.', tag: 'Smart' },
  { icon: Sparkles, title: 'Monthly insights', text: 'A plain-language recap of your month, generated from your own numbers and stored for later.', tag: 'Smart' },
  { icon: Lightbulb, title: 'Saving-tips engine', text: 'Ranked tips by potential rupee/dollar impact, with pin and dismiss so your list stays useful.', tag: 'Smart' },
  { icon: CloudUpload, title: 'CSV import', text: 'Bring a semester of history in one upload, with validation, preview and batch categorisation.', tag: 'Core' },
  { icon: FileText, title: 'Reports & PDF', text: 'Category breakdown, six-month trend, daily and weekly summaries — exported for your records.', tag: 'Core' },
  { icon: Bell, title: 'Alerts & notifications', text: 'Budget thresholds, savings milestones, duplicate and unusually large transactions.', tag: 'Smart' },
  { icon: ShieldCheck, title: 'Secure by design', text: 'Hashed passwords, JWT sessions and strict ownership checks on every record you own.', tag: 'Trust' },
  { icon: Moon, title: 'Dark mode & a11y', text: 'Polished dark theme, font-size control, reduced-motion support and breadcrumbs everywhere.', tag: 'Craft' },
];

const STEPS = [
  { icon: Wallet, title: 'Log it', text: 'Add an expense or income, or import a CSV. Categories are pre-loaded for student life.', detail: 'Takes ~5 seconds with the quick-add form.' },
  { icon: PieChart, title: 'See it', text: 'Your dashboard instantly shows where the money went: donut, trend, daily rhythm and top category.', detail: 'No spreadsheets, no manual maths.' },
  { icon: Target, title: 'Cap it', text: 'Set a monthly budget for the categories that matter and get warned before you overshoot.', detail: 'Alerts at 80% and when you cross the line.' },
  { icon: Lightbulb, title: 'Improve it', text: 'Ranked tips and a monthly insight tell you exactly where the next saving comes from.', detail: 'Examples: cut 2 delivery orders, audit subscriptions.' },
];

const BENEFITS = [
  { icon: GraduationCap, title: 'Built for irregular income', text: 'Allowance on day 1, a shift payment on day 14, a scholarship twice a semester — Campus Coin handles all of it.' },
  { icon: Coins, title: 'No bank link required', text: 'Log manually or import a CSV. No account aggregation, no data sharing with third parties.' },
  { icon: Users, title: 'Works for hostel communities', text: 'Track shared bills and splits clearly; useful for campus financial-literacy programmes too.' },
  { icon: TrendingUp, title: 'Progress you can see', text: 'Streaks, milestone badges and a funded-bar for every goal keep the habit going.' },
  { icon: Bell, title: 'Alerts that arrive in time', text: '"You are at 85% of your Food budget" lands while you can still change the month.' },
  { icon: Lock, title: 'Your data, your rules', text: 'Every endpoint is owner-scoped. Another student can never read your transactions by changing an id.' },
];

const TIPS_SHOWCASE = [
  { text: 'Cut two delivery orders this week — you average $11.60 per order.', gain: '+$93/mo', icon: UtensilsCrossed },
  { text: 'Netflix, Spotify and iCloud renew this week. Cancel one unused plan.', gain: '+$12/mo', icon: Repeat },
  { text: 'Set a weekly entertainment cap. Your weekends cost 60% more per day.', gain: '+$28/mo', icon: Clapperboard },
  { text: 'Save $110/month to hit "New laptop fund" by March.', gain: 'On track', icon: Target },
];

const FAQS = [
  {
    q: 'Do I need to connect my bank account?',
    a: 'No. Campus Coin deliberately works without bank integrations. You log transactions manually with the quick-add form, set up recurring entries for allowance and subscriptions, or import a CSV of past transactions.',
  },
  {
    q: 'Is the AI assistant required?',
    a: 'It is completely optional. The app ships with a rule-based categorisation engine and an analytics-written insights engine, so everything works with zero configuration. If you add an OpenAI-compatible API key, the assistant upgrades the wording and handles unusual descriptions — but the numbers always come from your own transactions, never from the model.',
  },
  {
    q: 'How are the insights and tips calculated?',
    a: 'They compare your current month against your own three-month average per category, your budget caps and your savings goal. Each tip carries an estimated monthly saving so the list can be ranked. Figures such as "Food is up 42% versus your average" are computed from your database records.',
  },
  {
    q: 'Does it work on my phone?',
    a: 'Yes — the interface is designed mobile-first with a bottom navigation bar, touch-friendly controls, card layouts instead of wide tables, and responsive charts that re-flow on small screens.',
  },
  {
    q: 'What happens to my data if I stop using it?',
    a: 'You can export any report as CSV or PDF at any time, and you can deactivate your account from Settings. Your data is stored in your own MongoDB instance — this project ships with the full backend so nothing is hidden behind a third-party service.',
  },
  {
    q: 'Is this real financial advice?',
    a: 'No. Campus Coin is an educational budgeting tool. AI-generated categorisation and monthly insights are suggestions you can review or override, not certified financial advice.',
  },
];

export default function Landing() {
  return (
    <>
      <Hero />
      <LogoStrip />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorks />
      <DashboardPreview />
      <SavingsVisualisation />
      <AiAssistantSection />
      <TipsSection />
      <BenefitsSection />
      <FaqSection />
      <SitemapSection />
      <FinalCta />
    </>
  );
}

/* ── 1. Hero ─────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pt-16 lg:pb-24 lg:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-coin-gradient" aria-hidden="true" />
      <div className="cc-grid-noise pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

      <div className="cc-section relative grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="cc-badge-info">
            <Sparkles className="h-3 w-3" />
            Theme · NextGen BudgetBee
          </span>

          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Your money. Your campus.{' '}
            <span className="bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 bg-clip-text text-transparent">
              Your control.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
            Generic finance apps are built for salaried adults. Campus Coin is built for you: allowance, part-time shifts,
            hostel bills, canteen food and subscriptions — tracked in seconds and turned into advice you can actually use.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/register" className="cc-btn-primary cc-btn-lg">
              Start Tracking Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Button variant="secondary" size="lg" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              See How It Works
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-ink-muted">
            {['No bank connection', 'Works offline of any API key', 'Free for students'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-mint-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-6 rounded-2xl border border-surface-border bg-surface/70 p-4 backdrop-blur">
            {[
              { value: '8 months', label: 'of demo history included' },
              { value: '12', label: 'student categories ready' },
              { value: '0', label: 'API keys required' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-xl font-bold text-ink">{stat.value}</p>
                <p className="text-xs text-ink-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 0.9, 0.32, 1] }}
          className="relative"
        >
          <div className="absolute -inset-4 rounded-[32px] bg-brand-500/10 blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-3xl border border-surface-border bg-surface shadow-lift">
            <div className="flex items-center gap-2 border-b border-surface-border bg-surface-muted px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-mint-400/80" />
              <span className="ml-2 text-2xs text-ink-soft">campuscoin.app/dashboard</span>
              <span className="ml-auto cc-badge-neutral">Preview</span>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: 'Balance', value: 1284.2, tone: 'text-ink' },
                  { label: 'Income', value: 476.0, tone: 'text-mint-600 dark:text-mint-400' },
                  { label: 'Spent', value: 392.4, tone: 'text-rose-600 dark:text-rose-400' },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-surface-border bg-surface-muted p-3">
                    <p className="text-2xs uppercase tracking-wide text-ink-soft">{card.label}</p>
                    <p className={`mt-1 font-display text-base font-bold tabular sm:text-lg ${card.tone}`}>
                      {formatMoney(card.value, '$', { decimals: 0 })}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface-muted p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink">This month's rhythm</p>
                  <span className="cc-badge-success">▲ 8% saved</span>
                </div>
                <DailySpendChart data={PREVIEW.daily} height={150} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-surface-border bg-surface-muted p-3">
                  <p className="mb-1 text-xs font-semibold text-ink">Where it went</p>
                  <CategoryDonutChart data={PREVIEW.categories} height={150} centerLabel="Spent" />
                </div>
                <div className="rounded-2xl border border-surface-border bg-surface-muted p-3">
                  <p className="mb-1 text-xs font-semibold text-ink">Insight of the month</p>
                  <p className="rounded-xl bg-brand-500/8 p-2.5 text-2xs leading-relaxed text-ink-muted">
                    <Sparkles className="mb-1 h-3.5 w-3.5 text-brand-500" />
                    Food is up 42% versus your three-month average. Capping delivery at twice a week saves about
                    <strong className="text-ink"> $93</strong> this month.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {PREVIEW.budgets.slice(0, 3).map((budget) => (
                      <div key={budget.name}>
                        <div className="flex items-center justify-between text-2xs text-ink-muted">
                          <span>{budget.name}</span>
                          <span className="tabular">
                            {formatMoney(budget.spent, '$', { decimals: 0 })} / {formatMoney(budget.limit, '$', { decimals: 0 })}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-soft/15">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (budget.spent / budget.limit) * 100)}%`,
                              background: budget.status === 'over' ? 'linear-gradient(90deg,#EF4444,#F87171)' : budget.status === 'near' ? 'linear-gradient(90deg,#F59E0B,#FBBF24)' : 'linear-gradient(90deg,#22C55E,#34D399)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ── 2. Trust strip ──────────────────────────────────────────────────────── */
function LogoStrip() {
  const items = [
    { icon: ShieldCheck, label: 'JWT + hashed passwords' },
    { icon: PieChart, label: 'Real aggregations, not mock data' },
    { icon: CloudUpload, label: 'CSV import with validation' },
    { icon: FileText, label: 'PDF & CSV report export' },
    { icon: Moon, label: 'Dark mode by default' },
    { icon: Bell, label: 'Budget alerts at 80%' },
  ];
  return (
    <section className="border-y border-surface-border bg-surface/50 py-6">
      <div className="cc-section flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {items.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
            <Icon className="h-4 w-4 text-brand-500" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ── 3. Problem ──────────────────────────────────────────────────────────── */
function ProblemSection() {
  return (
    <section className="cc-section py-20 sm:py-24" id="problem">
      <SectionHeading
        eyebrow="The problem"
        title="Student money disappears in small, boring ways"
        description="You are not bad with money. You are using apps designed for people with a fixed salary, a bank feed and no 3 a.m. assignment deadlines."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, text, tint }, index) => (
          <motion.article
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="cc-card cc-card-hover p-5"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: `${tint}1F`, color: tint }}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
          </motion.article>
        ))}
      </div>

      <div className="mt-12 grid gap-5 rounded-3xl border border-surface-border bg-surface/60 p-6 sm:grid-cols-3 sm:p-8">
        {[
          { value: '62%', label: 'of students say they do not know where most of their money goes' },
          { value: '3.4×', label: 'more food spending in the last week of the month than the first' },
          { value: '1 in 3', label: 'subscriptions students pay for but barely use' },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="font-display text-3xl font-bold text-brand-500">{stat.value}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{stat.label}</p>
          </div>
        ))}
        <p className="text-2xs text-ink-soft sm:col-span-3">
          Illustrative figures used to frame the problem — the dashboard itself always shows your own real numbers.
        </p>
      </div>
    </section>
  );
}

/* ── 4. Features ─────────────────────────────────────────────────────────── */
function FeaturesSection() {
  const [filter, setFilter] = useState('All');
  const tags = ['All', 'Core', 'Smart', 'Trust', 'Craft'];
  const visible = filter === 'All' ? FEATURES : FEATURES.filter((f) => f.tag === filter);

  return (
    <section className="relative py-20 sm:py-24" id="features">
      <div className="cc-section">
        <SectionHeading
          eyebrow="Features"
          title="Everything a student budget actually needs"
          description="Twelve features, all of them working against your own MongoDB data — including the SRS extras like recurring entries, CSV import and bookmarking."
        />

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilter(tag)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                filter === tag
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-surface-border bg-surface text-ink-muted hover:border-brand-400/60 hover:text-ink'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(({ icon: Icon, title, text, tag }, index) => (
            <motion.article
              key={title}
              layout
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.36, delay: (index % 6) * 0.04 }}
              className="cc-card cc-card-hover group relative overflow-hidden p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/12 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="cc-badge-neutral">{tag}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 5. How it works (interactive) ───────────────────────────────────────── */
function HowItWorks() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section className="cc-section py-20 sm:py-24" id="how-it-works">
      <SectionHeading
        eyebrow="How it works"
        title="Four steps, no finance degree"
        description="Tap through the flow that a new student follows in the first five minutes."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <ol className="space-y-2.5">
          {STEPS.map(({ icon: Icon, title, text }, index) => {
            const isActive = index === active;
            return (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-current={isActive}
                  className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
                    isActive
                      ? 'border-brand-400/70 bg-brand-500/8 shadow-soft'
                      : 'border-surface-border bg-surface hover:border-brand-400/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                        isActive ? 'bg-brand-500 text-white' : 'bg-brand-500/12 text-brand-500'
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <span className="text-2xs font-bold text-ink-soft">STEP {index + 1}</span>
                        {title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{text}</p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>

        <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="cc-card overflow-hidden">
          <div className="border-b border-surface-border bg-surface-muted px-5 py-3.5">
            <p className="text-sm font-semibold text-ink">Step {active + 1} · {step.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{step.detail}</p>
          </div>
          <div className="p-5">
            {active === 0 && <QuickAddMock />}
            {active === 1 && <DailySpendChart data={PREVIEW.daily} height={230} />}
            {active === 2 && <BudgetCompareChart data={PREVIEW.budgets} height={250} />}
            {active === 3 && (
              <ul className="space-y-3">
                {TIPS_SHOWCASE.slice(0, 3).map(({ text, gain, icon: Icon }) => (
                  <li key={text} className="flex items-start gap-3 rounded-2xl border border-surface-border bg-surface-muted p-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-500/14 text-mint-600">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-relaxed text-ink">{text}</p>
                      <p className="mt-1 text-2xs font-semibold uppercase tracking-wide text-mint-600">{gain}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function QuickAddMock() {
  const [amount, setAmount] = useState('9.50');
  const [description, setDescription] = useState('Campus cafe burger');
  return (
    <div className="space-y-3.5">
      <div className="flex gap-2">
        <span className="cc-badge-danger">Expense</span>
        <span className="cc-badge-neutral">Income</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="cc-label">Amount</span>
          <input className="cc-input" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="Amount" />
        </label>
        <label className="block">
          <span className="cc-label">Date</span>
          <input className="cc-input" defaultValue="2026-09-23" aria-label="Date" />
        </label>
      </div>
      <label className="block">
        <span className="cc-label">Description</span>
        <input className="cc-input" value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Description" />
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-400/40 bg-brand-500/8 p-3.5">
        <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
        <span className="text-xs font-semibold text-ink">AI suggestion</span>
        <span className="cc-badge-info">Food</span>
        <span className="text-2xs text-ink-muted">matches “burger” · 90% confidence · you can change it</span>
      </div>
      <p className="text-2xs text-ink-soft">
        Interactive preview — the real form also checks for duplicates, flags unusually large amounts and warns you when a budget
        is about to break.
      </p>
    </div>
  );
}

/* ── 6. Dashboard preview ────────────────────────────────────────────────── */
function DashboardPreview() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24" id="dashboard">
      <div className="pointer-events-none absolute inset-0 bg-coin-gradient opacity-60" aria-hidden="true" />
      <div className="cc-section relative">
        <SectionHeading
          eyebrow="Dashboard"
          title="The screen that answers “where did it go?”"
          description="Every widget is driven by MongoDB aggregation pipelines over your transactions — comparisons, trends and alerts included."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="cc-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Income vs expenses</p>
                <p className="text-xs text-ink-muted">Last six months</p>
              </div>
              <span className="cc-badge-info">DB aggregation</span>
            </div>
            <IncomeExpenseChart data={PREVIEW.trend} height={280} />
          </div>

          <div className="space-y-5">
            {[
              { title: 'Top category', body: 'Food · $138.40 (32% of spend)', meta: 'Food spending increased 42% versus your 3-month average.', tone: 'warning', icon: PieChart },
              { title: 'Budget alerts', body: 'Entertainment is 130% of its cap', meta: 'In-app notification sent when it crossed 80% and 100%.', tone: 'danger', icon: Bell },
              { title: 'Savings goal', body: 'New laptop fund · 45% funded', meta: '$660 to go · on pace for March 2027 at your current rate.', tone: 'success', icon: Target },
              { title: 'Personalised tip', body: 'Cut 2 delivery orders this week', meta: 'Estimated saving: $93/month · ranked #1 by impact.', tone: 'info', icon: Lightbulb },
            ].map(({ title, body, meta, tone, icon: Icon }) => (
              <div key={title} className="cc-card cc-card-hover p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      tone === 'danger' ? 'bg-rose-500/12 text-rose-500'
                        : tone === 'warning' ? 'bg-amber-500/12 text-amber-500'
                          : tone === 'success' ? 'bg-mint-500/12 text-mint-600'
                            : 'bg-brand-500/12 text-brand-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-soft">{title}</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">{body}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{meta}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft">
          Marketing preview with illustrative figures. Sign in with the demo account to see the same widgets filled with
          eight months of seeded transactions.
        </p>
      </div>
    </section>
  );
}

/* ── 7. Savings / budget visualisation ───────────────────────────────────── */
function SavingsVisualisation() {
  const goals = [
    { name: 'New laptop fund', target: 1200, saved: 540, color: 'from-brand-500 to-accent-400' },
    { name: 'Semester trip', target: 300, saved: 210, color: 'from-mint-500 to-accent-400' },
    { name: 'Emergency buffer', target: 400, saved: 90, color: 'from-amber-500 to-brand-500' },
  ];

  return (
    <section className="cc-section py-20 sm:py-24" id="benefits">
      <SectionHeading
        eyebrow="Budgets & goals"
        title="Watch progress instead of guessing"
        description="Budgets show safe, near-limit and over states with animated bars. Goals show how much is left, whether you are on pace, and celebrate milestones."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="cc-card p-6">
          <h3 className="text-sm font-semibold text-ink">Monthly budget consumption</h3>
          <p className="mb-5 mt-1 text-xs text-ink-muted">Live percentages with alert thresholds at 80%.</p>
          <div className="space-y-4">
            {PREVIEW.budgets.map((budget) => {
              const percent = Math.min(100, Math.round((budget.spent / budget.limit) * 100));
              const tone = budget.status === 'over' ? 'danger' : budget.status === 'near' ? 'warning' : 'success';
              return (
                <div key={budget.name}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{budget.name}</span>
                    <span className="tabular text-ink-muted">
                      {formatMoney(budget.spent, '$', { decimals: 0 })} / {formatMoney(budget.limit, '$', { decimals: 0 })}
                      <span className={`ml-2 font-semibold ${tone === 'danger' ? 'text-rose-500' : tone === 'warning' ? 'text-amber-500' : 'text-mint-600'}`}>
                        {percent}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-ink-soft/15">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${percent}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: [0.22, 0.9, 0.32, 1] }}
                      className={`h-full rounded-full ${
                        tone === 'danger' ? 'bg-danger-gradient' : tone === 'warning' ? 'bg-warn-gradient' : 'bg-mint-gradient'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cc-card p-6">
          <h3 className="text-sm font-semibold text-ink">Savings goals</h3>
          <p className="mb-5 mt-1 text-xs text-ink-muted">Milestones at 25 / 50 / 75 / 100% trigger a notification.</p>
          <div className="space-y-4">
            {goals.map((goal) => {
              const percent = Math.round((goal.saved / goal.target) * 100);
              return (
                <div key={goal.name} className="rounded-2xl border border-surface-border bg-surface-muted p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{goal.name}</p>
                    <span className="cc-badge-success">{percent}%</span>
                  </div>
                  <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-ink-soft/15">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${percent}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: [0.22, 0.9, 0.32, 1] }}
                      className={`h-full rounded-full bg-gradient-to-r ${goal.color}`}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-ink-muted">
                    <span className="tabular">{formatMoney(goal.saved, '$', { decimals: 0 })} saved</span>
                    <span className="tabular">{formatMoney(goal.target - goal.saved, '$', { decimals: 0 })} to go</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 8. AI assistant ─────────────────────────────────────────────────────── */
function AiAssistantSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24" id="ai">
      <div className="cc-section">
        <div className="overflow-hidden rounded-3xl border border-surface-border bg-surface">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 sm:p-10">
              <span className="cc-badge-info">
                <Wand2 className="h-3 w-3" />
                Optional AI assistant
              </span>
              <h2 className="mt-5 text-balance font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Smart suggestions. Your final call.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                The assistant reads your description as you type and proposes a category — then hands control straight back to
                you. Accept it, change it, and Campus Coin remembers the correction so the next similar entry lands correctly.
              </p>

              <ul className="mt-6 space-y-3.5">
                {[
                  { title: 'Advisory, never automatic', text: 'Both the suggested and confirmed category are stored so you can audit any posting.' },
                  { title: 'Learns from your corrections', text: 'Feedback is recorded per description and re-used before the model is ever consulted.' },
                  { title: 'Works without an API key', text: 'A weighted keyword engine and analytics-written insight narratives keep every feature alive.' },
                  { title: 'Honest labelling', text: 'Every insight is marked as AI-assisted or analytics-generated, and clearly not financial advice.' },
                ].map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-500" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative border-t border-surface-border bg-surface-muted p-8 sm:p-10 lg:border-l lg:border-t-0">
              <div className="space-y-3">
                {[
                  { input: 'Bought burger from campus cafe', suggestion: 'Food', confidence: 90 },
                  { input: 'Netflix monthly payment', suggestion: 'Subscriptions', confidence: 95 },
                  { input: 'Metro card top up', suggestion: 'Transport', confidence: 88 },
                  { input: 'Photocopy of past papers', suggestion: 'Academics', confidence: 83 },
                ].map(({ input, suggestion, confidence }, index) => (
                  <motion.div
                    key={input}
                    initial={{ opacity: 0, x: 14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}
                    className="rounded-2xl border border-surface-border bg-surface p-3.5"
                  >
                    <p className="text-xs text-ink-muted">“{input}”</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                        {suggestion}
                      </span>
                      <span className="cc-badge-success">{confidence}% confidence</span>
                      <span className="ml-auto flex gap-1.5">
                        <span className="rounded-lg bg-brand-500 px-2.5 py-1 text-2xs font-semibold text-white">Accept</span>
                        <span className="rounded-lg border border-surface-border px-2.5 py-1 text-2xs font-semibold text-ink-muted">Change</span>
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3.5">
                <p className="text-2xs leading-relaxed text-ink-muted">
                  <strong className="text-ink">Note:</strong> AI output is advisory. Campus Coin never claims to provide
                  professional financial advice, and every suggestion can be overridden in one tap.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 9. Saving tips ──────────────────────────────────────────────────────── */
function TipsSection() {
  return (
    <section className="cc-section py-20 sm:py-24" id="tips">
      <SectionHeading
        eyebrow="Saving tips"
        title="Advice ranked by what it actually saves you"
        description="The tips engine compares this month against your own history and ranks every suggestion by estimated monthly impact."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {TIPS_SHOWCASE.map(({ text, gain, icon: Icon }, index) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, delay: index * 0.06 }}
            className="cc-card cc-card-hover flex items-start gap-4 p-5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-ink">{text}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="cc-badge-success">{gain}</span>
                <span className="inline-flex items-center gap-1 text-2xs text-ink-soft">
                  <Pin className="h-3 w-3" /> pin
                </span>
                <span className="text-2xs text-ink-soft">· dismiss · bookmark</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-ink-muted">
        <span className="cc-badge-info"><CalendarClock className="h-3 w-3" /> Regenerated monthly</span>
        <span className="cc-badge-info"><Compass className="h-3 w-3" /> Based on your own averages</span>
        <span className="cc-badge-info"><CreditCard className="h-3 w-3" /> No paid tiers or upsells</span>
      </div>
    </section>
  );
}

/* ── 10. Benefits ────────────────────────────────────────────────────────── */
function BenefitsSection() {
  return (
    <section className="cc-section py-20 sm:py-24" id="who">
      <SectionHeading
        eyebrow="Benefits"
        title="Why students keep using it"
        description="Not a generic finance dashboard — every decision here comes from how student money actually behaves."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, text }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="cc-card p-5"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-400/12 text-accent-500">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-3.5 text-base font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── 11. FAQ ─────────────────────────────────────────────────────────────── */
function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section className="cc-section py-20 sm:py-24" id="faq">
      <SectionHeading eyebrow="FAQ" title="Questions students actually ask" />
      <div className="mx-auto mt-10 max-w-3xl divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface">
        {FAQS.map((faq, index) => {
          const isOpen = open === index;
          return (
            <div key={faq.q}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-brand-500/[.04]"
              >
                <span className="text-sm font-semibold text-ink">{faq.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.28, ease: [0.22, 0.9, 0.32, 1] }}
                className="overflow-hidden"
              >
                <p className="px-5 pb-4 text-sm leading-relaxed text-ink-muted">{faq.a}</p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── 12. Sitemap (explicit SRS requirement) ──────────────────────────────── */
function SitemapSection() {
  return (
    <section className="cc-section py-20 sm:py-24" id="sitemap">
      <SectionHeading
        eyebrow="Site map"
        title="Every page in Campus Coin, mapped out"
        description="The public site, the student application and the administrator control panel — click through to any branch."
      />
      <div className="mt-10">
        <SitemapTree />
      </div>
    </section>
  );
}

/* ── 13. Final CTA ───────────────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="cc-section pb-4">
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-center sm:px-12">
        <div className="absolute inset-0 bg-coin-gradient" aria-hidden="true" />
        <div className="cc-grid-noise absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Start your first month with Campus Coin today
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/75 sm:text-base">
            Create an account, log a handful of transactions, and watch the dashboard explain your own habits back to you.
            Nothing to connect, nothing to pay.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className="cc-btn-lg inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-white/90">
              Start Tracking Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="cc-btn-lg inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10">
              Try the demo account
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/60">
            Demo student: demo@campuscoin.com · Demo admin: admin@campuscoin.com — passwords are in the README.
          </p>
        </div>
      </div>
    </section>
  );
}
