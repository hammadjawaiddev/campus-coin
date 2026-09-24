import { useMemo, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, CalendarClock, CheckCircle2, Flag, Minus, Pencil, Plus,
  Sparkles, Target, Trash2, TrendingUp, Trophy, Wallet,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, ProgressBar, Toggle } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/Feedback.jsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { goalApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney } from '../utils/format.js';

const GOAL_ICONS = ['Target', 'Laptop', 'Plane', 'GraduationCap', 'Smartphone', 'Bike', 'Home', 'Camera', 'Music', 'Gift', 'Shield', 'Sparkles'];
const GOAL_COLORS = ['#22C55E', '#6D5DFB', '#0EA5E9', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6'];

const BLANK = { name: '', targetAmount: '', currentAmount: '', targetDate: '', color: GOAL_COLORS[0], icon: 'Target', note: '', isPrimary: false };

export default function Goals() {
  const { user } = useAuth();
  const toast = useToast();
  const symbol = currencySymbol(user?.preferences?.currency);

  const { data, isLoading, error, reload, refresh } = useApi(() => goalApi.list(), { deps: [] });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');
  const [contributeTarget, setContributeTarget] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributeMode, setContributeMode] = useState('add');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveAction = useApiAction((payload) => (editing ? goalApi.update(editing.id, payload) : goalApi.create(payload)), {
    onSuccess: () => {
      toast.success(editing ? 'Goal updated' : 'Goal created', {
        description: editing ? undefined : 'Add a contribution whenever you put money aside.',
      });
      setEditorOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (err) => setFormError(err.message),
  });

  const contributeAction = useApiAction(({ id, amount }) => goalApi.contribute(id, amount), {
    onSuccess: (response) => {
      const goal = response.data?.goal;
      toast.success(contributeMode === 'add' ? 'Contribution saved' : 'Withdrawal recorded', {
        description: goal ? `${goal.name} is now at ${goal.progress}% (${formatMoney(goal.currentAmount, symbol)}).` : undefined,
      });
      if (response.data?.milestone) {
        toast.success(`Milestone reached: ${response.data.milestone.percent}% 🎉`, { description: 'Nice — keep the pace going.' });
      }
      setContributeTarget(null);
      setContributeAmount('');
      refresh();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not update the goal'),
  });

  const statusAction = useApiAction(({ id, status }) => goalApi.update(id, { status }), {
    onSuccess: () => {
      toast.success('Goal marked as achieved 🎉', { description: 'It moved to your completed goals.' });
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not update the goal status'),
  });

  const deleteAction = useApiAction((id) => goalApi.remove(id), {
    onSuccess: () => {
      toast.success('Goal deleted');
      setDeleteTarget(null);
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not delete that goal'),
  });

  const goals = data?.goals || [];
  const summary = data?.summary;
  const activeGoals = data?.active || [];
  const completedGoals = data?.completed || [];

  const nextMilestone = useMemo(() => {
    if (!contributeTarget) return null;
    return [25, 50, 75, 100].find((milestone) => milestone > contributeTarget.progress);
  }, [contributeTarget]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (goal) => {
    setEditing(goal);
    setForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : '',
      color: goal.color,
      icon: goal.icon,
      note: goal.note || '',
      isPrimary: goal.isPrimary,
    });
    setFormError('');
    setEditorOpen(true);
  };

  const submit = (event) => {
    event.preventDefault();
    const target = Number(form.targetAmount);
    if (form.name.trim().length < 2) return setFormError('Give your goal a name');
    if (!target || target <= 0) return setFormError('Enter a target amount greater than zero');
    setFormError('');
    return saveAction.run({
      name: form.name.trim(),
      targetAmount: target,
      currentAmount: Number(form.currentAmount) || 0,
      targetDate: form.targetDate || null,
      color: form.color,
      icon: form.icon,
      note: form.note,
      isPrimary: form.isPrimary,
    });
  };

  const openContribute = (goal, mode = 'add') => {
    setContributeTarget(goal);
    setContributeMode(mode);
    setContributeAmount(mode === 'add' ? String(Math.max(10, Math.round(goal.remaining / 4))) : '10');
  };

  const submitContribution = (event) => {
    event.preventDefault();
    const amount = Number(contributeAmount);
    if (!amount || amount <= 0) return toast.error('Enter an amount greater than zero');
    const signed = contributeMode === 'add' ? amount : -amount;
    if (contributeMode === 'withdraw' && amount > contributeTarget.currentAmount) {
      return toast.error('You cannot withdraw more than the goal has saved');
    }
    return contributeAction.run({ id: contributeTarget.id, amount: signed });
  };

  return (
    <>
      <PageHeader
        title="Savings goals"
        description="Name what you are saving for. Naming a goal is the single biggest predictor of actually reaching it."
        crumbs={[{ label: 'Savings goals' }]}
        icon={Target}
        actions={<Button size="sm" icon={Plus} onClick={openCreate}>New goal</Button>}
      />

      {summary && goals.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Saved so far</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-mint-600 dark:text-mint-400">{formatMoney(summary.totalSaved, symbol, { decimals: 0 })}</p>
            <p className="text-2xs text-ink-soft">of {formatMoney(summary.totalTarget, symbol, { decimals: 0 })} targeted</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Overall progress</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-ink">{summary.overallProgress}%</p>
            <ProgressBar value={summary.overallProgress} tone="success" height="h-1.5" className="mt-2" />
          </Card>
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Monthly pace</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-ink">{formatMoney(summary.monthlyPace, symbol, { decimals: 0 })}</p>
            <p className="text-2xs text-ink-soft">What you actually kept this month</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">Active goals</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-ink">{activeGoals.length}</p>
            <p className="text-2xs text-ink-soft">{completedGoals.length} completed</p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
        </div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="No savings goals yet"
            description="Start with something concrete — a laptop fund, a trip with friends, next semester's fees. You can contribute any amount, any time."
            actionLabel="Create your first goal"
            onAction={openCreate}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <Card key={goal.id} hover className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${goal.color}1F`, color: goal.color }}>
                    <CategoryIcon name={goal.icon} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {goal.name}
                      {goal.isPrimary && <Badge tone="info">primary</Badge>}
                      {goal.status === 'completed' && <Badge tone="success">achieved</Badge>}
                    </p>
                    <p className="mt-0.5 text-2xs text-ink-soft">
                      {goal.targetDate
                        ? `Target ${new Date(goal.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'No target date'}
                      {goal.monthsLeft !== null && ` · ${goal.monthsLeft} month${goal.monthsLeft === 1 ? '' : 's'} left`}
                    </p>
                    {goal.note && <p className="mt-1 text-2xs italic text-ink-soft">{goal.note}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" icon={Pencil} onClick={() => openEdit(goal)} aria-label={`Edit ${goal.name}`} />
                  <Button variant="ghost" size="icon-sm" className="text-rose-500" icon={Trash2} onClick={() => setDeleteTarget(goal)} aria-label={`Delete ${goal.name}`} />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-end justify-between">
                  <span className="font-display text-2xl font-bold tabular text-ink">{formatMoney(goal.currentAmount, symbol, { decimals: 0 })}</span>
                  <span className="text-xs text-ink-muted">of {formatMoney(goal.targetAmount, symbol, { decimals: 0 })}</span>
                </div>
                <ProgressBar value={goal.progress} barClass="bg-mint-gradient" height="h-2.5" />
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-soft">
                  <span className="font-semibold text-ink-muted">{goal.progress}% complete</span>
                  <span>{formatMoney(goal.remaining, symbol, { decimals: 0 })} to go</span>
                  {goal.requiredMonthly ? <span>{formatMoney(goal.requiredMonthly, symbol, { decimals: 0 })}/month needed</span> : null}
                  {goal.onTrack !== null && (
                    <Badge tone={goal.onTrack ? 'success' : 'warning'}>{goal.onTrack ? 'On pace' : 'Behind pace'}</Badge>
                  )}
                </div>
              </div>

              {goal.milestones?.length > 0 && (
                <div className="mt-3.5 flex items-center gap-1.5">
                  {[25, 50, 75, 100].map((milestone) => {
                    const reached = goal.milestones.some((entry) => entry.percent === milestone);
                    return (
                      <span
                        key={milestone}
                        title={reached ? `${milestone}% reached` : `${milestone}% not reached yet`}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-2xs ${
                          reached ? 'border-mint-500/40 bg-mint-500/10 text-mint-700 dark:text-mint-400' : 'border-surface-border text-ink-soft'
                        }`}
                      >
                        {reached ? <Trophy className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
                        {milestone}%
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-surface-border pt-4">
                <Button size="sm" icon={ArrowUpCircle} onClick={() => openContribute(goal, 'add')} disabled={goal.status === 'completed'}>
                  Add money
                </Button>
                <Button size="sm" variant="secondary" icon={ArrowDownCircle} onClick={() => openContribute(goal, 'withdraw')} disabled={goal.currentAmount <= 0}>
                  Withdraw
                </Button>
                {goal.status === 'active' && goal.progress >= 100 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={CheckCircle2}
                    loading={statusAction.isRunning}
                    onClick={() => statusAction.run({ id: goal.id, status: 'completed' })}
                  >
                    Mark achieved
                  </Button>
                )}
                <span className="ml-auto inline-flex items-center gap-1.5 text-2xs text-ink-soft">
                  <TrendingUp className="h-3 w-3" />
                  Pace {formatMoney(goal.monthlyPace || 0, symbol, { decimals: 0 })}/month
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {goals.length > 0 && summary?.studentSavingsTarget > 0 && (
        <Card className="mt-5 p-5">
          <CardHeader title="Your stated savings target" subtitle="The number you gave during onboarding" icon={Wallet} />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-bold tabular text-ink">{formatMoney(summary.studentSavingsTarget, symbol, { decimals: 0 })}</p>
              <p className="text-xs text-ink-muted">
                Across your goals you have saved {formatMoney(summary.totalSaved, symbol, { decimals: 0 })} — that is{' '}
                {Math.round((summary.totalSaved / Math.max(1, summary.studentSavingsTarget)) * 100)}% of the target.
              </p>
            </div>
            <ProgressBar
              value={Math.min(100, (summary.totalSaved / Math.max(1, summary.studentSavingsTarget)) * 100)}
              tone="brand"
              height="h-2"
              className="w-full sm:w-64"
            />
          </div>
          <p className="mt-3 text-2xs text-ink-soft">
            Change this figure any time from <strong className="text-ink-muted">Profile → savings target</strong>.
          </p>
        </Card>
      )}

      {/* ── Editor ─────────────────────────────────────────────────── */}
      <Modal
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New savings goal'}
        description="Be specific: “MacBook for final year” beats “savings” every time."
        icon={Target}
        size="lg"
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
              {formError}
            </div>
          )}

          <label className="block">
            <span className="cc-label">Goal name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="cc-input"
              placeholder="New laptop fund"
              maxLength={80}
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="cc-label">Target amount</span>
              <input
                type="number"
                min="1"
                value={form.targetAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, targetAmount: event.target.value }))}
                className="cc-input"
                placeholder="1200"
                required
              />
            </label>
            <label className="block">
              <span className="cc-label">Already saved</span>
              <input
                type="number"
                min="0"
                value={form.currentAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, currentAmount: event.target.value }))}
                className="cc-input"
                placeholder="0"
              />
            </label>
            <label className="block">
              <span className="cc-label">Target date (optional)</span>
              <input
                type="date"
                value={form.targetDate}
                onChange={(event) => setForm((prev) => ({ ...prev, targetDate: event.target.value }))}
                className="cc-input"
              />
            </label>
          </div>

          <div>
            <span className="cc-label">Icon</span>
            <div className="cc-scroll-x flex gap-2 pb-1">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, icon }))}
                  aria-pressed={form.icon === icon}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${
                    form.icon === icon ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-surface-border text-ink-muted hover:border-brand-400/40'
                  }`}
                >
                  <CategoryIcon name={icon} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="cc-label">Colour</span>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  aria-pressed={form.color === color}
                  className={`h-8 w-8 rounded-full border-2 transition ${form.color === color ? 'scale-110 border-ink' : 'border-transparent'}`}
                  style={{ background: color }}
                  aria-label={`Use colour ${color}`}
                />
              ))}
            </div>
          </div>

          <label className="block">
            <span className="cc-label">Note (optional)</span>
            <input
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              className="cc-input"
              placeholder="For final-year project work and freelancing"
              maxLength={120}
            />
          </label>

          <div className="rounded-xl border border-surface-border bg-surface-muted p-3.5">
            <Toggle
              id="goal-primary"
              checked={form.isPrimary}
              onChange={(value) => setForm((prev) => ({ ...prev, isPrimary: value }))}
              label="Make this my primary goal"
              description="The dashboard highlights your primary goal first."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setEditorOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" loading={saveAction.isRunning}>{editing ? 'Save changes' : 'Create goal'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Contribute ─────────────────────────────────────────────── */}
      <Modal
        open={Boolean(contributeTarget)}
        onClose={() => setContributeTarget(null)}
        title={contributeMode === 'add' ? `Add to ${contributeTarget?.name}` : `Withdraw from ${contributeTarget?.name}`}
        description={
          contributeMode === 'add'
            ? 'Every contribution is recorded against the goal and updates your progress instantly.'
            : 'Withdrawing reduces the goal balance — useful when you actually spend the money you saved.'
        }
        icon={contributeMode === 'add' ? ArrowUpCircle : ArrowDownCircle}
      >
        {contributeTarget && (
          <form onSubmit={submitContribution} className="space-y-4">
            <div className="rounded-2xl border border-surface-border bg-surface-muted p-3.5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>{formatMoney(contributeTarget.currentAmount, symbol)} saved</span>
                <span>{formatMoney(contributeTarget.remaining, symbol)} remaining</span>
              </div>
              <ProgressBar value={contributeTarget.progress} barClass="bg-mint-gradient" height="h-2" className="mt-2" />
              {nextMilestone && (
                <p className="mt-2 text-2xs text-ink-soft">
                  Next milestone: {nextMilestone}% — that is {formatMoney(Math.max(0, (nextMilestone / 100) * contributeTarget.targetAmount - contributeTarget.currentAmount), symbol)} away.
                </p>
              )}
            </div>

            <div>
              <span className="cc-label">Amount</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-ink-soft">{symbol}</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={contributeAmount}
                  onChange={(event) => setContributeAmount(event.target.value)}
                  className="cc-input h-12 pl-10 font-display text-lg font-bold tabular"
                  autoFocus
                  required
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[10, 25, 50, 100].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setContributeAmount(String(quick))}
                    className="rounded-lg border border-surface-border px-2.5 py-1 text-2xs text-ink-muted transition hover:border-brand-400/50 hover:text-ink"
                  >
                    +{formatMoney(quick, symbol, { decimals: 0 })}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setContributeAmount(String(contributeTarget.remaining))}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-400/40 bg-brand-500/[.06] px-2.5 py-1 text-2xs text-brand-600 transition hover:bg-brand-500/12 dark:text-brand-300"
                >
                  <Sparkles className="h-3 w-3" />
                  Finish it ({formatMoney(contributeTarget.remaining, symbol, { decimals: 0 })})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-surface-border p-1.5">
              <button
                type="button"
                onClick={() => setContributeMode('add')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${contributeMode === 'add' ? 'bg-brand-500 text-white' : 'text-ink-muted hover:bg-ink-soft/10'}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add money
              </button>
              <button
                type="button"
                onClick={() => setContributeMode('withdraw')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${contributeMode === 'withdraw' ? 'bg-ink text-white' : 'text-ink-muted hover:bg-ink-soft/10'}`}
              >
                <Minus className="h-3.5 w-3.5" />
                Withdraw
              </button>
            </div>

            <p className="flex items-start gap-2 text-2xs leading-relaxed text-ink-soft">
              <CalendarClock className="mt-0.5 h-3 w-3 shrink-0" />
              Contributions are tracked separately from your transactions, so they never distort your spending reports.
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setContributeTarget(null)}>Cancel</Button>
              <Button type="submit" loading={contributeAction.isRunning} icon={contributeMode === 'add' ? ArrowUpCircle : ArrowDownCircle}>
                {contributeMode === 'add' ? 'Add to goal' : 'Withdraw'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteAction.run(deleteTarget?.id)}
        loading={deleteAction.isRunning}
        title={`Delete “${deleteTarget?.name}”?`}
        message={`This removes the goal and its milestone history. The ${formatMoney(deleteTarget?.currentAmount || 0, symbol)} you recorded as saved is not affected anywhere else.`}
        confirmLabel="Delete goal"
      />
    </>
  );
}
