import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BarChart3, Check, GraduationCap, Landmark, PartyPopper, SkipForward, Sparkles, Target, Wallet,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { Logo } from '../../components/ui/Brand.jsx';
import { ProgressBar } from '../../components/ui/Primitives.jsx';
import CategoryIcon from '../../components/ui/CategoryIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authApi, budgetApi, categoryApi, goalApi } from '../../services/endpoints.js';
import { CURRENCY_SYMBOLS, monthKey, monthLabel } from '../../utils/format.js';

const ACADEMIC_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Postgraduate', 'Other'];

/** Common student categories the student can keep (the rest can be deleted later). */
const COMMON_CATEGORIES = ['Food', 'Transport', 'Hostel/Rent', 'Academics', 'Subscriptions', 'Entertainment'];

export default function Onboarding() {
  const { user, refresh, applySession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name || '',
    academicYear: user?.academicYear || '1st Year',
    university: user?.university || '',
  });
  const [income, setIncome] = useState({
    monthlyAllowance: user?.monthlyAllowance || '',
    currency: user?.preferences?.currency || 'USD',
  });
  const [goal, setGoal] = useState({ name: 'My first savings fund', targetAmount: user?.savingsGoal || 500, targetDate: '' });
  const [selectedCategories, setSelectedCategories] = useState(COMMON_CATEGORIES);
  const [budget, setBudget] = useState({ categoryName: 'Food', limitAmount: 150 });

  const steps = useMemo(
    () => [
      { key: 'profile', title: 'Your student profile', icon: GraduationCap, subtitle: 'So your dashboard greets you properly.' },
      { key: 'income', title: 'Income baseline', icon: Wallet, subtitle: 'Used to calculate how much of your money is unspent.' },
      { key: 'goal', title: 'A savings goal', icon: Target, subtitle: 'Even a small target changes spending behaviour.' },
      { key: 'categories', title: 'Your categories', icon: Sparkles, subtitle: 'Untick anything you will never use.' },
      { key: 'budget', title: 'First monthly budget', icon: BarChart3, subtitle: 'A soft cap on your biggest category.' },
    ],
    [],
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const finish = async ({ skipped = false } = {}) => {
    setSaving(true);
    try {
      const response = await authApi.completeOnboarding({
        name: skipped ? undefined : profile.name,
        academicYear: skipped ? undefined : profile.academicYear,
        monthlyAllowance: skipped ? undefined : Number(income.monthlyAllowance) || 0,
        savingsGoal: skipped ? undefined : Number(goal.targetAmount) || 0,
        currency: income.currency,
      });
      if (response.data?.user) applySession(null, response.data.user);

      if (!skipped) {
        // Create the goal + first budget (best effort: never blocks finishing).
        if (Number(goal.targetAmount) > 0) {
          await goalApi
            .create({
              name: goal.name || 'My first savings fund',
              targetAmount: Number(goal.targetAmount),
              currentAmount: 0,
              targetDate: goal.targetDate || null,
              isPrimary: true,
            })
            .catch(() => {});
        }
        const { data } = await budgetApi.list({ month: monthKey() }).catch(() => ({ data: null }));
        const category = data?.budgets?.find((row) => row.categoryName === budget.categoryName)
          || data?.suggestions?.find((row) => row.name === budget.categoryName);
        const categoryId = category?.categoryId || category?.id;
        if (categoryId && Number(budget.limitAmount) > 0) {
          await budgetApi.save({ categoryId, limitAmount: Number(budget.limitAmount), month: monthKey() }).catch(() => {});
        }
      }

      await refresh();
      toast.success(skipped ? 'Onboarding skipped' : 'You are all set 🎉', {
        description: skipped ? 'You can finish this later from Settings.' : 'Your dashboard is ready.',
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.fromError(error, 'We could not save your onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-coin-gradient opacity-70" aria-hidden="true" />

      <div className="relative mx-auto flex max-w-2xl flex-col">
        <header className="flex items-center justify-between">
          <Logo size={36} to="/dashboard" />
          <Button variant="ghost" size="sm" icon={SkipForward} onClick={() => finish({ skipped: true })} loading={saving} disabled={saving}>
            Skip for now
          </Button>
        </header>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
            <span>
              Step {step + 1} of {steps.length}
            </span>
            <span>{Math.round(((step + 1) / steps.length) * 100)}% complete</span>
          </div>
          <ProgressBar value={((step + 1) / steps.length) * 100} height="h-1.5" />

          <ol className="mt-5 hidden gap-2 sm:flex" aria-label="Onboarding steps">
            {steps.map((item, index) => (
              <li key={item.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => index <= step && setStep(index)}
                  disabled={index > step}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                    index === step
                      ? 'border-brand-400/70 bg-brand-500/10 font-semibold text-ink'
                      : index < step
                        ? 'border-surface-border bg-surface text-ink-muted hover:border-brand-400/40'
                        : 'border-dashed border-surface-border bg-surface/60 text-ink-soft'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {index < step ? <Check className="h-3 w-3 text-mint-500" /> : <item.icon className="h-3.5 w-3.5" />}
                    {item.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="cc-card mt-6 p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.key}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.26, ease: [0.22, 0.9, 0.32, 1] }}
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/12 text-brand-500">
                <current.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-xl font-bold tracking-tight text-ink sm:text-2xl">{current.title}</h1>
              <p className="mt-1.5 text-sm text-ink-muted">{current.subtitle}</p>

              <div className="mt-6 space-y-4">
                {current.key === 'profile' && (
                  <>
                    <label className="block">
                      <span className="cc-label">Display name</span>
                      <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} className="cc-input" placeholder="Ayesha Khan" />
                    </label>
                    <label className="block">
                      <span className="cc-label">Academic year</span>
                      <select value={profile.academicYear} onChange={(e) => setProfile((p) => ({ ...p, academicYear: e.target.value }))} className="cc-select">
                        {ACADEMIC_YEARS.map((year) => <option key={year}>{year}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="cc-label">University / college (optional)</span>
                      <input value={profile.university} onChange={(e) => setProfile((p) => ({ ...p, university: e.target.value }))} className="cc-input" placeholder="NED University" />
                    </label>
                  </>
                )}

                {current.key === 'income' && (
                  <>
                    <label className="block">
                      <span className="cc-label">Typical monthly income (allowance + job + stipend)</span>
                      <input
                        type="number"
                        min="0"
                        value={income.monthlyAllowance}
                        onChange={(e) => setIncome((p) => ({ ...p, monthlyAllowance: e.target.value }))}
                        className="cc-input"
                        placeholder="350"
                      />
                      <span className="mt-1 block text-2xs text-ink-soft">Used for your savings rate and “unspent allowance” widget.</span>
                    </label>
                    <label className="block">
                      <span className="cc-label">Currency</span>
                      <select value={income.currency} onChange={(e) => setIncome((p) => ({ ...p, currency: e.target.value }))} className="cc-select">
                        {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                          <option key={code} value={code}>{code} ({symbol})</option>
                        ))}
                      </select>
                    </label>
                    <p className="rounded-xl border border-surface-border bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted">
                      <Landmark className="mr-1.5 inline h-3.5 w-3.5 text-brand-500" />
                      Nothing is linked to a bank. This is just a baseline you can change any time.
                    </p>
                  </>
                )}

                {current.key === 'goal' && (
                  <>
                    <label className="block">
                      <span className="cc-label">What are you saving for?</span>
                      <input
                        value={goal.name}
                        onChange={(e) => setGoal((p) => ({ ...p, name: e.target.value }))}
                        className="cc-input"
                        placeholder="New laptop fund"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="cc-label">Target amount</span>
                        <input
                          type="number"
                          min="1"
                          value={goal.targetAmount}
                          onChange={(e) => setGoal((p) => ({ ...p, targetAmount: e.target.value }))}
                          className="cc-input"
                        />
                      </label>
                      <label className="block">
                        <span className="cc-label">Target date (optional)</span>
                        <input
                          type="date"
                          value={goal.targetDate}
                          onChange={(e) => setGoal((p) => ({ ...p, targetDate: e.target.value }))}
                          className="cc-input"
                        />
                      </label>
                    </div>
                  </>
                )}

                {current.key === 'categories' && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {COMMON_CATEGORIES.map((name) => {
                      const checked = selectedCategories.includes(name);
                      return (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCategories((prev) => (checked ? prev.filter((c) => c !== name) : [...prev, name]))
                            }
                            aria-pressed={checked}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                              checked ? 'border-brand-400/70 bg-brand-500/8 text-ink' : 'border-surface-border bg-surface text-ink-muted'
                            }`}
                          >
                            <span className={`grid h-5 w-5 place-items-center rounded-md border ${checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-surface-border'}`}>
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <CategoryIcon name={CATEGORY_ICONS[name] || 'Package'} className="h-4 w-4" />
                            {name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {current.key === 'budget' && (
                  <>
                    <p className="rounded-xl border border-surface-border bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted">
                      We will create a {monthLabel(new Date())} budget so your dashboard has something to track against from day one.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="cc-label">Category</span>
                        <select value={budget.categoryName} onChange={(e) => setBudget((p) => ({ ...p, categoryName: e.target.value }))} className="cc-select">
                          {COMMON_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="cc-label">Monthly cap</span>
                        <input
                          type="number"
                          min="1"
                          value={budget.limitAmount}
                          onChange={(e) => setBudget((p) => ({ ...p, limitAmount: e.target.value }))}
                          className="cc-input"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
              Back
            </Button>

            {isLast ? (
              <Button icon={PartyPopper} loading={saving} onClick={() => finish({})}>
                Finish & open dashboard
              </Button>
            ) : (
              <Button iconRight={ArrowRight} onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={saving}>
                Continue
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-2xs text-ink-soft">
          Every step is optional — you can change all of this later in Profile and Settings.
        </p>
      </div>
    </div>
  );
}

const CATEGORY_ICONS = {
  Food: 'UtensilsCrossed',
  Transport: 'Bus',
  'Hostel/Rent': 'Home',
  Academics: 'BookOpen',
  Subscriptions: 'Repeat',
  Entertainment: 'Clapperboard',
};
