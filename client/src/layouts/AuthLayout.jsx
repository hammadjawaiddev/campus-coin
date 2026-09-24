import { Link, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, LineChart, Sparkles, Wallet } from 'lucide-react';
import Logo from '../components/ui/Brand';
import { useTheme } from '../context/ThemeContext';

const HIGHLIGHTS = [
  { icon: Wallet, title: 'Log anything in seconds', text: 'Quick-add income and expenses with student categories that actually match campus life.' },
  { icon: LineChart, title: 'See where it goes', text: 'Category donuts, six-month trends and budget bars generated from your own transactions.' },
  { icon: Sparkles, title: 'Get tips that fit', text: 'A rules engine plus optional AI assistant turns your history into concrete savings moves.' },
];

/** Split-screen auth shell: form on the left, brand story on the right. */
export default function AuthLayout({ title, subtitle, footer, children, wide = false }) {
  const { isDark } = useTheme();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Logo size={38} />
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-brand-500">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to site
            </Link>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{subtitle}</p>}
            <div className={`mt-7 ${wide ? '' : ''}`}>{children}</div>
          </motion.div>

          {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>

      {/* Brand panel — hidden on small screens so mobile forms get full focus. */}
      <aside className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-coin-gradient" aria-hidden="true" />
        <div className="cc-grid-noise absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div>
            <span className="cc-badge bg-white/10 text-white/90">Theme · NextGen BudgetBee</span>
            <h2 className="mt-6 max-w-md text-4xl font-bold leading-tight tracking-tight">
              Your money. Your campus. Your control.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
              Campus Coin turns messy student spending into clear numbers: allowance, shifts, hostel bills, canteen runs and
              subscriptions — all in one dashboard that speaks plain language.
            </p>
          </div>

          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, text }) => (
              <li key={itemTitle} className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 backdrop-blur">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{itemTitle}</p>
                  <p className="mt-0.5 max-w-xs text-xs leading-relaxed text-white/65">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[.06] p-4 backdrop-blur">
            <BadgeCheck className="h-5 w-5 shrink-0 text-mint-400" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-white/75">
              Demo accounts are seeded with eight months of realistic transactions, budgets and insights — sign in and the
              dashboard is already alive.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
