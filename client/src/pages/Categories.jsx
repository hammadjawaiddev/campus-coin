import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRightLeft, Layers, Pencil, Plus, RotateCcw, Search, Tag, Trash2, TrendingUp, Wallet,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, Segmented, Toggle } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback.jsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { categoryApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney } from '../utils/format.js';

const BLANK = { name: '', type: 'expense', icon: 'Package', color: '#6D5DFB', monthlyBudgetHint: '', keywords: '' };

export default function Categories() {
  const { user } = useAuth();
  const toast = useToast();
  const symbol = currencySymbol(user?.preferences?.currency);

  const { data, isLoading, error, reload, refresh } = useApi(() => categoryApi.list(), { deps: [] });
  const [filter, setFilter] = useState('expense');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [usage, setUsage] = useState(null);

  const options = data?.options || { icons: [], colors: [], defaults: [] };

  const createAction = useApiAction((payload) => (editing ? categoryApi.update(editing.id, payload) : categoryApi.create(payload)), {
    onSuccess: () => {
      toast.success(editing ? 'Category updated' : 'Category added');
      setEditorOpen(false);
      setEditing(null);
      setForm(BLANK);
      refresh();
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteAction = useApiAction(({ id, reassignTo: target }) => categoryApi.remove(id, target ? { reassignTo: target } : undefined), {
    onSuccess: (response) => {
      toast.success(response.message || 'Category deleted');
      setDeleteTarget(null);
      setReassignTo('');
      setUsage(null);
      refresh();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not delete that category'),
  });

  const restoreAction = useApiAction(() => categoryApi.restoreDefaults(), {
    onSuccess: (response) => {
      toast.success(response.message || 'Default categories restored');
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not restore the defaults'),
  });

  const all = data?.categories || [];
  const visible = useMemo(() => {
    const base = filter === 'all' ? all : all.filter((category) => category.type === filter);
    if (!search.trim()) return base;
    const needle = search.trim().toLowerCase();
    return base.filter((category) => category.name.toLowerCase().includes(needle));
  }, [all, filter, search]);

  const totals = useMemo(() => {
    const expense = (data?.expense || []).reduce((sum, category) => sum + (category.totalAmount || 0), 0);
    const income = (data?.income || []).reduce((sum, category) => sum + (category.totalAmount || 0), 0);
    return { expense, income };
  }, [data]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...BLANK, type: filter === 'all' ? 'expense' : filter });
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setForm({
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      monthlyBudgetHint: category.monthlyBudgetHint || '',
      keywords: (category.keywords || []).join(', '),
    });
    setFormError('');
    setEditorOpen(true);
  };

  const submit = (event) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      setFormError('Give the category a name of at least 2 characters');
      return;
    }
    createAction.run({
      name: form.name.trim(),
      type: form.type,
      icon: form.icon,
      color: form.color,
      monthlyBudgetHint: Number(form.monthlyBudgetHint) || 0,
      keywords: form.keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    });
  };

  const askDelete = async (category) => {
    setDeleteTarget(category);
    setReassignTo('');
    setUsage(null);
    try {
      const response = await categoryApi.usage(category.id);
      setUsage(response.data);
    } catch {
      setUsage(null);
    }
  };

  const reassignOptions = (data?.categories || []).filter(
    (category) => category.type === deleteTarget?.type && category.id !== deleteTarget?.id,
  );

  return (
    <>
      <PageHeader
        title="Categories"
        description="Your default student categories plus any you add. Deleting a category never deletes history — you choose what happens to the entries."
        crumbs={[{ label: 'Categories' }]}
        icon={Tag}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RotateCcw} loading={restoreAction.isRunning} onClick={() => restoreAction.run()}>
              Restore defaults
            </Button>
            <Button size="sm" icon={Plus} onClick={openCreate}>
              New category
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-2xs uppercase tracking-wide text-ink-soft">Categories</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">{all.length}</p>
          <p className="text-2xs text-ink-soft">{data?.expense?.length || 0} expense · {data?.income?.length || 0} income</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs uppercase tracking-wide text-ink-soft">Lifetime expenses</p>
          <p className="mt-1 font-display text-2xl font-bold tabular text-rose-600 dark:text-rose-400">{formatMoney(totals.expense, symbol, { decimals: 0 })}</p>
          <p className="text-2xs text-ink-soft">Across every category you have used</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs uppercase tracking-wide text-ink-soft">Lifetime income</p>
          <p className="mt-1 font-display text-2xl font-bold tabular text-mint-600 dark:text-mint-400">{formatMoney(totals.income, symbol, { decimals: 0 })}</p>
          <p className="text-2xs text-ink-soft">Allowance, job, scholarship and gifts</p>
        </Card>
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            ariaLabel="Filter categories"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'expense', label: 'Expense', icon: Wallet },
              { value: 'income', label: 'Income', icon: TrendingUp },
              { value: 'all', label: 'All', icon: Layers },
            ]}
          />
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories…"
              className="cc-input pl-10"
              aria-label="Search categories"
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tag}
            title={search ? 'No category matches that search' : 'No categories in this tab'}
            description={search ? 'Try a different name.' : 'Add a category for something specific to your student life — “Lab materials”, “Bus pass”, “Society dues”.'}
            actionLabel="New category"
            onAction={openCreate}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((category) => (
            <Card key={category.id} hover className="flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}1F`, color: category.color }}>
                  <CategoryIcon name={category.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold text-ink">
                    {category.name}
                    {category.isDefault && <Badge tone="neutral">default</Badge>}
                  </p>
                  <p className="mt-0.5 text-2xs text-ink-soft">
                    {category.transactionCount} transaction{category.transactionCount === 1 ? '' : 's'} · {formatMoney(category.totalAmount || 0, symbol, { decimals: 0 })} lifetime
                  </p>
                </div>
              </div>

              {category.keywords?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {category.keywords.slice(0, 4).map((keyword) => (
                    <span key={keyword} className="cc-badge-neutral text-2xs normal-case">{keyword}</span>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-center gap-2 pt-4">
                <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openEdit(category)}>Edit</Button>
                <Link
                  to={`/transactions?category=${category.id}`}
                  className="cc-btn-ghost cc-btn-sm"
                  title="View transactions in this category"
                >
                  View
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-rose-500"
                  icon={Trash2}
                  onClick={() => askDelete(category)}
                  aria-label={`Delete ${category.name}`}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Editor ─────────────────────────────────────────────────── */}
      <Modal
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New category'}
        description="Icons and colours keep your charts readable — pick something you will recognise instantly."
        icon={Tag}
        size="lg"
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="cc-label">Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="cc-input"
                placeholder="Lab materials"
                maxLength={40}
                required
              />
            </label>
            <label className="block">
              <span className="cc-label">Type</span>
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                className="cc-select"
                disabled={Boolean(editing?.transactionCount)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              {editing?.transactionCount > 0 && (
                <span className="mt-1 block text-2xs text-ink-soft">Type is locked because this category already has transactions.</span>
              )}
            </label>
          </div>

          <label className="block">
            <span className="cc-label">Monthly budget hint (optional)</span>
            <input
              type="number"
              min="0"
              value={form.monthlyBudgetHint}
              onChange={(event) => setForm((prev) => ({ ...prev, monthlyBudgetHint: event.target.value }))}
              className="cc-input"
              placeholder="150"
            />
            <span className="mt-1 block text-2xs text-ink-soft">Used as the starting suggestion on the budgets screen.</span>
          </label>

          <label className="block">
            <span className="cc-label">Assistant keywords (comma separated)</span>
            <input
              value={form.keywords}
              onChange={(event) => setForm((prev) => ({ ...prev, keywords: event.target.value }))}
              className="cc-input"
              placeholder="printer, stationery, lab"
            />
            <span className="mt-1 block text-2xs text-ink-soft">
              The rule-based categoriser matches these words when you have no history for a description yet.
            </span>
          </label>

          <div>
            <span className="cc-label">Icon</span>
            <div className="cc-scroll-x flex gap-2 pb-1">
              {(options.icons || []).map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, icon }))}
                  aria-pressed={form.icon === icon}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${
                    form.icon === icon ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-surface-border text-ink-muted hover:border-brand-400/40'
                  }`}
                  title={icon}
                >
                  <CategoryIcon name={icon} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="cc-label">Colour</span>
            <div className="flex flex-wrap gap-2">
              {(options.colors || []).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  aria-pressed={form.color === color}
                  className={`h-8 w-8 rounded-full border-2 transition ${form.color === color ? 'border-ink scale-110' : 'border-transparent'}`}
                  style={{ background: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-muted p-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: `${form.color}1F`, color: form.color }}>
              <CategoryIcon name={form.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{form.name || 'Preview'}</p>
              <p className="text-2xs text-ink-soft">{form.type === 'income' ? 'Income category' : 'Expense category'}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setEditorOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" loading={createAction.isRunning}>{editing ? 'Save changes' : 'Add category'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete with reassignment ───────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => { setDeleteTarget(null); setReassignTo(''); setUsage(null); }}
        onConfirm={() => deleteAction.run({ id: deleteTarget.id, reassignTo })}
        loading={deleteAction.isRunning}
        tone="danger"
        title={`Delete “${deleteTarget?.name}”?`}
        message={
          usage?.transactionCount
            ? `${usage.transactionCount} transaction${usage.transactionCount === 1 ? '' : 's'} worth ${formatMoney(usage.totalAmount || 0, symbol)} use this category. Choose what should happen to them.`
            : 'This category has no transactions, so nothing else is affected.'
        }
        confirmLabel="Delete category"
        children={
          usage?.transactionCount ? (
            <div className="mt-3 space-y-2">
              <p className="text-2xs uppercase tracking-wide text-ink-soft">Move its transactions to</p>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 shrink-0 text-ink-soft" />
                <select value={reassignTo} onChange={(event) => setReassignTo(event.target.value)} className="cc-select">
                  <option value="">Leave them uncategorised (deleted category keeps its records)</option>
                  {reassignOptions.map((category) => (
                    <option key={category.id} value={category.id}>Move to {category.name}</option>
                  ))}
                </select>
              </div>
              {deleteTarget?.isDefault && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[.07] p-2.5 text-2xs leading-relaxed text-ink-muted">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  This is one of the built-in student categories. You can bring it back later with “Restore defaults”.
                </p>
              )}
            </div>
          ) : null
        }
      />
    </>
  );
}
