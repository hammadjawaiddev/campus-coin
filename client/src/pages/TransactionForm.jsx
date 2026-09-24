import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Bookmark, Calendar, Check, CheckCircle2, Copy, Info, Lightbulb, Loader2, Plus,
  Repeat, Save, Sparkles, Trash2, TrendingUp, Wand2, Wallet, X,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, Segmented, Toggle } from '../components/ui/Primitives.jsx';
import { ErrorState, Skeleton } from '../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { transactionApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney, toDateInput } from '../utils/format.js';
import { useDebounced } from '../hooks/useApi.js';

const FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];

const EMPTY = {
  type: 'expense',
  amount: '',
  category: '',
  description: '',
  notes: '',
  date: toDateInput(new Date()),
  recurring: false,
  recurringFrequency: 'monthly',
};

export default function TransactionForm({ mode = 'create' }) {
  const { id } = useParams();
  const isEdit = mode === 'edit';
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const symbol = currencySymbol(user?.preferences?.currency);

  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveAnother, setSaveAnother] = useState(false);

  // AI suggestion state — advisory only, always overridable.
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [usedSuggestion, setUsedSuggestion] = useState(false);

  // Pre-check state (duplicates, unusually large amounts, budget impact).
  const [precheck, setPrecheck] = useState(null);
  const [checking, setChecking] = useState(false);

  const amountRef = useRef(null);
  const descriptionRef = useRef(null);

  const debouncedDescription = useDebounced(form.description, 500);
  const debouncedAmount = useDebounced(form.amount, 500);

  /* ── Load metadata (+ the transaction when editing) ───────────────── */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [metaResponse, txResponse] = await Promise.all([
          transactionApi.meta(),
          isEdit ? transactionApi.get(id) : Promise.resolve(null),
        ]);
        if (!active) return;
        setMeta(metaResponse.data);

        if (txResponse?.data?.transaction) {
          const tx = txResponse.data.transaction;
          setForm({
            type: tx.type,
            amount: String(tx.amount),
            category: tx.category?._id || tx.category || '',
            description: tx.description || '',
            notes: tx.notes || '',
            date: toDateInput(tx.date),
            recurring: Boolean(tx.recurring),
            recurringFrequency: tx.recurringFrequency || 'monthly',
          });
        } else {
          setForm((prev) => ({ ...prev, type: 'expense' }));
        }
      } catch (error) {
        if (active) setFormError(error.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, isEdit]);

  useEffect(() => {
    if (!loading) amountRef.current?.focus();
  }, [loading]);

  const categories = useMemo(
    () => (meta?.categories || []).filter((category) => category.type === form.type),
    [meta, form.type],
  );

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, amount: undefined, category: undefined }));
  }, []);

  /* ── AI categorisation suggestion ─────────────────────────────────── */
  useEffect(() => {
    if (loading || suggestionDismissed) return undefined;
    const description = debouncedDescription.trim();
    if (description.length < 3) {
      setSuggestion(null);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setSuggesting(true);
    transactionApi
      .suggest({ description, type: form.type, amount: Number(form.amount) || 0 })
      .then((response) => {
        if (!active) return;
        setSuggestion(response.data?.suggested ? response.data : null);
      })
      .catch(() => {
        if (active) setSuggestion(null);
      })
      .finally(() => {
        if (active) setSuggesting(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDescription, form.type, suggestionDismissed, loading]);

  const acceptSuggestion = (categoryId) => {
    setForm((prev) => ({ ...prev, category: categoryId }));
    setUsedSuggestion(true);
    setSuggestionDismissed(true);
    toast.success('Category applied', { description: 'You can still change it — the suggestion is never final.' });
  };

  /* ── Duplicate / anomaly / budget pre-check ───────────────────────── */
  useEffect(() => {
    if (loading) return undefined;
    const amount = Number(debouncedAmount);
    if (!amount || amount <= 0) {
      setPrecheck(null);
      return undefined;
    }

    let active = true;
    setChecking(true);
    transactionApi
      .precheck({
        amount,
        type: form.type,
        date: form.date,
        description: form.description,
        categoryId: form.category || undefined,
        excludeId: isEdit ? id : undefined,
      })
      .then((response) => {
        if (active) setPrecheck(response.data);
      })
      .catch(() => {
        if (active) setPrecheck(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAmount, form.type, form.date, form.description, form.category]);

  /* ── Validation ───────────────────────────────────────────────────── */
  const validate = () => {
    const next = {};
    const amount = Number(form.amount);
    if (!amount || amount <= 0) next.amount = 'Enter an amount greater than zero';
    else if (amount > 100000000) next.amount = 'That amount looks too large';
    if (!form.category) next.category = 'Choose a category';
    if (!form.date) next.date = 'Choose a date';
    else if (new Date(form.date) > new Date(Date.now() + 86400000)) next.date = 'Date cannot be more than a day in the future';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const payload = () => ({
    type: form.type,
    amount: Number(form.amount),
    category: form.category,
    description: form.description.trim(),
    notes: form.notes.trim(),
    date: new Date(`${form.date}T12:00:00Z`).toISOString(),
    recurring: form.recurring,
    recurringFrequency: form.recurring ? form.recurringFrequency : null,
    ...(usedSuggestion && suggestion
      ? {
          aiSuggestedCategory: suggestion.suggested.categoryId,
          aiConfidence: suggestion.suggested.confidence,
          aiSource: suggestion.suggested.source,
        }
      : {}),
  });

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (isEdit) {
        await transactionApi.update(id, payload());
        toast.success('Transaction updated', { description: 'Budgets and alerts were recalculated.' });
        navigate('/transactions');
      } else {
        const response = await transactionApi.create(payload());
        const warnings = response.data?.warnings || [];
        toast.success('Transaction added', {
          description: warnings.length ? warnings[0] : `${formatMoney(Number(form.amount), symbol)} recorded.`,
        });
        if (saveAnother) {
          setForm({ ...EMPTY, type: form.type, date: form.date });
          setSuggestion(null);
          setUsedSuggestion(false);
          setSuggestionDismissed(false);
          setPrecheck(null);
          descriptionRef.current?.focus();
        } else {
          navigate('/transactions');
        }
      }
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    } catch (error) {
      setFormError(error.message);
      if (Array.isArray(error.details)) {
        setErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await transactionApi.remove(id);
      toast.success('Transaction deleted');
      navigate('/transactions');
    } catch (error) {
      toast.fromError(error, 'Could not delete that transaction');
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  /* ── Keyboard shortcut: ⌘/Ctrl + Enter saves ───────────────────────── */
  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submit(event);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title={isEdit ? 'Edit transaction' : 'Add a transaction'} />
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Card className="space-y-4 p-5">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-11 w-full" />)}
          </Card>
          <Card className="p-5"><Skeleton className="h-40 w-full" /></Card>
        </div>
      </>
    );
  }

  const selectedCategory = categories.find((category) => category.id === form.category);

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit transaction' : 'Add a transaction'}
        description={
          isEdit
            ? 'Update the details — budgets, alerts and insights recalculate automatically.'
            : 'Record income or an expense. The AI assistant suggests a category, you stay in control.'
        }
        crumbs={[{ label: 'Transactions', to: '/transactions' }, { label: isEdit ? 'Edit' : 'New' }]}
        icon={Plus}
        actions={
          <Link to="/transactions" className="cc-btn-ghost cc-btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to list
          </Link>
        }
      />

      {formError && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {formError}
        </div>
      )}

      <form onSubmit={submit} onKeyDown={onKeyDown} noValidate className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* ── Left: the form ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                ariaLabel="Transaction type"
                value={form.type}
                onChange={(value) => update('type', value)}
                options={[
                  { value: 'expense', label: 'Expense', icon: Wallet },
                  { value: 'income', label: 'Income', icon: TrendingUp },
                ]}
              />
              <span className="text-2xs text-ink-soft">Press ⌘/Ctrl + Enter to save</span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="cc-label">Amount</span>
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-lg font-semibold text-ink-soft">
                    {symbol}
                  </span>
                  <input
                    ref={amountRef}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(event) => update('amount', event.target.value)}
                    placeholder="0.00"
                    className={`cc-input h-14 pl-10 font-display text-xl font-bold tabular ${errors.amount ? 'cc-input-error' : ''}`}
                    aria-invalid={Boolean(errors.amount)}
                    required
                  />
                </span>
                {errors.amount && <span className="cc-error-text">{errors.amount}</span>}
              </label>

              <label className="block sm:col-span-1">
                <span className="cc-label">Date</span>
                <span className="relative block">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
                  <input
                    type="date"
                    value={form.date}
                    max={toDateInput(new Date(Date.now() + 86400000))}
                    onChange={(event) => update('date', event.target.value)}
                    className={`cc-input pl-10 ${errors.date ? 'cc-input-error' : ''}`}
                    required
                  />
                </span>
                <span className="mt-1.5 flex gap-1.5">
                  {[
                    { label: 'Today', value: toDateInput(new Date()) },
                    { label: 'Yesterday', value: toDateInput(new Date(Date.now() - 86400000)) },
                  ].map((quick) => (
                    <button
                      key={quick.label}
                      type="button"
                      onClick={() => update('date', quick.value)}
                      className={`rounded-lg border px-2 py-1 text-2xs transition ${
                        form.date === quick.value ? 'border-brand-400/60 bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'border-surface-border text-ink-muted hover:border-brand-400/40'
                      }`}
                    >
                      {quick.label}
                    </button>
                  ))}
                </span>
                {errors.date && <span className="cc-error-text">{errors.date}</span>}
              </label>

              <label className="block sm:col-span-2">
                <span className="cc-label">Description</span>
                <span className="relative block">
                  <input
                    ref={descriptionRef}
                    value={form.description}
                    onChange={(event) => {
                      update('description', event.target.value);
                      setSuggestionDismissed(false);
                    }}
                    maxLength={200}
                    placeholder={form.type === 'income' ? 'Monthly allowance from home' : 'Campus cafe burger'}
                    className="cc-input pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {suggesting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-500" aria-label="Getting a suggestion" />
                    ) : (
                      <Wand2 className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                    )}
                  </span>
                </span>
                <span className="mt-1 block text-2xs text-ink-soft">
                  A clear description improves the categorisation assistant and your reports.
                </span>
              </label>

              <label className="block sm:col-span-2">
                <span className="cc-label">Notes (optional)</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Split with two classmates, paid back on Friday…"
                  className="cc-textarea"
                />
              </label>
            </div>
          </Card>

          {/* ── Category picker ─────────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader
              title="Category"
              subtitle={`${categories.length} ${form.type} categories available`}
              icon={Bookmark}
              action={<Link to="/categories" className="cc-link text-xs">Manage categories</Link>}
            />
            {errors.category && <span className="cc-error-text mb-2 block">{errors.category}</span>}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((category) => {
                const selected = form.category === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => update('category', category.id)}
                    aria-pressed={selected}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      selected
                        ? 'border-transparent ring-2 ring-brand-500/60'
                        : 'border-surface-border hover:border-brand-400/40'
                    }`}
                    style={selected ? { backgroundColor: `${category.color}14` } : undefined}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${category.color}1F`, color: category.color }}>
                      <CategoryIcon name={category.icon} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 truncate font-medium text-ink">{category.name}</span>
                    {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-brand-500" />}
                  </button>
                );
              })}
            </div>

            {/* ── Recurring ──────────────────────────────────────────── */}
            <div className="mt-5 rounded-2xl border border-surface-border bg-surface-muted p-4">
              <Toggle
                id="recurring-toggle"
                checked={form.recurring}
                onChange={(value) => update('recurring', value)}
                label="This repeats"
                description="Recurring entries are added automatically when they fall due."
              />
              {form.recurring && (
                <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="cc-label">Frequency</span>
                    <select value={form.recurringFrequency} onChange={(event) => update('recurringFrequency', event.target.value)} className="cc-select">
                      {FREQUENCIES.map((frequency) => (
                        <option key={frequency.value} value={frequency.value}>{frequency.label}</option>
                      ))}
                    </select>
                  </label>
                  <p className="self-end text-2xs leading-relaxed text-ink-soft">
                    <Repeat className="mr-1 inline h-3 w-3" />
                    The next entry is scheduled automatically from the date you picked. Pause or end it any time from{' '}
                    <Link to="/transactions" className="underline">Transactions → Recurring</Link>.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={saving} icon={Save}>
              {isEdit ? 'Save changes' : 'Add transaction'}
            </Button>
            {!isEdit && (
              <Button
                type="submit"
                variant="secondary"
                icon={Plus}
                loading={saving && saveAnother}
                onClick={() => setSaveAnother(true)}
              >
                Save & add another
              </Button>
            )}
            <Link to="/transactions" className="cc-btn-ghost">Cancel</Link>
            {isEdit && (
              <Button type="button" variant="ghost" className="ml-auto text-rose-500" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* ── Right: assistant + checks ──────────────────────────────── */}
        <div className="space-y-5">
          {/* AI suggestion */}
          <Card className="p-5">
            <CardHeader
              title="Categorisation assistant"
              subtitle={suggestion?.aiConfigured ? 'AI-assisted with your own history' : 'Learns from your past entries (rule engine)'}
              icon={Sparkles}
            />

            {suggestion ? (
              <div className="rounded-2xl border border-brand-500/25 bg-brand-500/[.06] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${suggestion.suggested.color}1F`, color: suggestion.suggested.color }}>
                    <CategoryIcon name={suggestion.suggested.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {suggestion.suggested.categoryName}
                      <span className="ml-2">
                        <Badge tone={suggestion.suggested.confidence >= 0.7 ? 'success' : suggestion.suggested.confidence >= 0.45 ? 'warning' : 'neutral'}>
                          {Math.round((suggestion.suggested.confidence || 0) * 100)}% confident
                        </Badge>
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{suggestion.suggested.reason}</p>
                    <p className="mt-1 text-2xs text-ink-soft">
                      Source: {suggestion.source === 'ai' ? 'AI model' : suggestion.source === 'history' ? 'your past choices' : 'keyword rules'}
                      {!suggestion.aiConfigured && ' · AI key not configured, using the deterministic fallback'}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap gap-2">
                  <Button size="sm" icon={Check} onClick={() => acceptSuggestion(suggestion.suggested.categoryId)} disabled={form.category === suggestion.suggested.categoryId}>
                    {form.category === suggestion.suggested.categoryId ? 'Applied' : 'Use this category'}
                  </Button>
                  <Button size="sm" variant="ghost" icon={X} onClick={() => setSuggestionDismissed(true)}>
                    Not this
                  </Button>
                </div>

                {suggestion.alternatives?.length > 0 && (
                  <div className="mt-3.5 border-t border-brand-500/20 pt-3">
                    <p className="text-2xs uppercase tracking-wide text-ink-soft">Other options</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggestion.alternatives.map((alternative) => (
                        <button
                          key={alternative.categoryId}
                          type="button"
                          onClick={() => acceptSuggestion(alternative.categoryId)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-ink-muted transition hover:border-brand-400/50 hover:text-ink"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: alternative.color }} aria-hidden="true" />
                          {alternative.categoryName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-surface-border p-4 text-xs leading-relaxed text-ink-muted">
                {suggesting ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking for a match…</span>
                ) : (
                  <>
                    <Lightbulb className="mr-1.5 inline h-3.5 w-3.5 text-brand-500" />
                    Type a description (for example “Netflix”, “metro card” or “photocopy”) and a category will be suggested from
                    your own history and keyword rules. Suggestions never save by themselves.
                  </>
                )}
              </div>
            )}

            {suggestion && form.category && form.category !== suggestion.suggested.categoryId && (
              <p className="mt-3 text-2xs leading-relaxed text-ink-soft">
                You chose <strong className="text-ink">{selectedCategory?.name}</strong> instead of{' '}
                <strong className="text-ink">{suggestion.suggested.categoryName}</strong>. Both the suggestion and your confirmed
                category are stored, and the assistant learns from the correction.
              </p>
            )}
          </Card>

          {/* Pre-checks */}
          <Card className="p-5">
            <CardHeader
              title="Before you save"
              subtitle="Duplicate, size and budget checks"
              icon={Info}
              action={checking ? <Loader2 className="h-4 w-4 animate-spin text-ink-soft" aria-label="Checking" /> : null}
            />

            {!precheck ? (
              <p className="rounded-2xl border border-dashed border-surface-border p-4 text-xs text-ink-muted">
                Enter an amount to run duplicate, unusual-size and budget checks.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {precheck.duplicate?.isDuplicate && (
                  <li className="rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-3.5">
                    <p className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <Copy className="h-3.5 w-3.5" />
                      Possible double entry
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{precheck.duplicate.reason}</p>
                    {precheck.duplicate.matches?.slice(0, 2).map((match) => (
                      <p key={match.id} className="mt-1.5 rounded-lg bg-surface/70 px-2.5 py-1.5 text-2xs text-ink-muted">
                        {new Date(match.date).toLocaleDateString('en-GB')} · {formatMoney(match.amount, symbol)} · {match.description || match.categoryName}
                      </p>
                    ))}
                  </li>
                )}

                {precheck.large?.isAnomaly && (
                  <li className="rounded-xl border border-rose-500/30 bg-rose-500/[.07] p-3.5">
                    <p className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Unusually large for this category
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{precheck.large.reason}</p>
                    {precheck.large.reference ? (
                      <p className="mt-1 text-2xs text-ink-soft">Your usual spend here is about {formatMoney(precheck.large.reference, symbol)}.</p>
                    ) : null}
                  </li>
                )}

                {precheck.budget && (
                  <li className="rounded-xl border border-surface-border bg-surface-muted p-3.5">
                    <p className="text-xs font-semibold text-ink">
                      {precheck.budget.categoryName} budget impact
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {formatMoney(precheck.budget.spent, symbol)} spent of {formatMoney(precheck.budget.limit, symbol)} · this entry
                      takes you to <strong className="text-ink">{Math.round(precheck.budget.projectedPercent)}%</strong>
                      {precheck.budget.projectedPercent > 100 ? ' — over budget' : precheck.budget.projectedPercent >= precheck.budget.alertThreshold ? ' — close to the cap' : ''}.
                    </p>
                  </li>
                )}

                {!precheck.duplicate?.isDuplicate && !precheck.large?.isAnomaly && !precheck.budget && (
                  <li className="flex items-center gap-2 rounded-xl border border-mint-500/30 bg-mint-500/[.07] p-3.5 text-xs text-mint-700 dark:text-mint-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    No duplicates or size warnings — this entry looks normal.
                  </li>
                )}
              </ul>
            )}
          </Card>

          {/* Live summary */}
          <Card className="p-5">
            <CardHeader title="Summary" subtitle="What will be saved" icon={Wallet} />
            <dl className="space-y-2.5 text-sm">
              <Row label="Type" value={form.type === 'income' ? 'Income' : 'Expense'} />
              <Row
                label="Amount"
                value={form.amount ? formatMoney(Number(form.amount), symbol) : '—'}
                tone={form.type === 'income' ? 'positive' : 'default'}
              />
              <Row label="Category" value={selectedCategory?.name || 'Not chosen'} />
              <Row label="Date" value={form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
              <Row label="Repeats" value={form.recurring ? FREQUENCIES.find((f) => f.value === form.recurringFrequency)?.label || 'Monthly' : 'No'} />
              {usedSuggestion && (
                <Row label="AI suggestion" value={`${suggestion?.suggested.categoryName} (stored for learning)`} />
              )}
            </dl>
          </Card>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={saving}
        title="Delete this transaction?"
        message="It will be removed from your history and all budgets, reports and insights will recalculate. This cannot be undone."
        confirmLabel="Delete transaction"
      />
    </>
  );
}

function Row({ label, value, tone = 'default' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-2 last:border-0 last:pb-0">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className={`tabular text-right text-sm font-medium ${tone === 'positive' ? 'text-mint-600 dark:text-mint-400' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}
