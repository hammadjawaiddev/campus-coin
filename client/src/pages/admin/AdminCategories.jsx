import { useMemo, useState } from 'react';
import {
  Archive, ArchiveRestore, Layers, Pencil, Plus, Search, ShieldPlus, Tag, Trash2, Users,
} from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Badge, Segmented } from '../../components/ui/Primitives.jsx';
import CategoryIcon from '../../components/ui/CategoryIcon.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { useApi, useApiAction } from '../../hooks/useApi.js';
import { adminApi } from '../../services/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatMoney } from '../../utils/format.js';

const EMPTY_FORM = { id: null, name: '', type: 'expense', icon: 'Package', color: '#6D5DFB', keywords: '', monthlyBudgetHint: '' };

export default function AdminCategories() {
  const toast = useToast();
  const { data, isLoading, error, reload, refresh } = useApi(() => adminApi.categories(), { deps: [] });

  const [filters, setFilters] = useState({ search: '', type: 'all', archived: 'active' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const saveAction = useApiAction(
    (payload) => (payload.id ? adminApi.updateCategory(payload.id, payload) : adminApi.createCategory(payload)),
    {
      onSuccess: (response) => {
        toast.success(response.message || 'Default category saved');
        setFormOpen(false);
        setForm(EMPTY_FORM);
        refresh();
      },
      onError: (err) => toast.fromError(err, 'Could not save that default category'),
    },
  );

  const archiveAction = useApiAction(({ id, isArchived }) => adminApi.updateCategory(id, { isArchived }), {
    onSuccess: (response) => {
      toast.success(response.message || 'Default category updated');
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not update that default category'),
  });

  const deleteAction = useApiAction((id) => adminApi.deleteCategory(id), {
    onSuccess: (response) => {
      toast.success(response.message || 'Default category removed');
      setDeleteTarget(null);
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not remove that default category'),
  });

  const applyAction = useApiAction(() => adminApi.applyCategories(), {
    onSuccess: (response) => {
      toast.success(response.message || 'Defaults applied to every student');
      setApplyOpen(false);
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not apply defaults'),
  });

  const templates = data?.templates || [];
  const options = data?.options || { icons: [], colors: [] };

  const filtered = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return templates.filter((row) => {
      if (filters.type !== 'all' && row.type !== filters.type) return false;
      if (filters.archived === 'active' && row.isArchived) return false;
      if (filters.archived === 'archived' && !row.isArchived) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle) || (row.keywords || []).some((word) => word.includes(needle));
    });
  }, [templates, filters]);

  const stats = useMemo(() => {
    const income = templates.filter((row) => row.type === 'income').length;
    const expense = templates.filter((row) => row.type === 'expense').length;
    const archived = templates.filter((row) => row.isArchived).length;
    const studentsUsing = templates.reduce((sum, row) => sum + (row.studentsUsing || 0), 0);
    return { income, expense, archived, studentsUsing };
  }, [templates]);

  const openCreate = () => { setForm({ ...EMPTY_FORM, color: options.colors?.[0] || '#6D5DFB', icon: options.icons?.[0] || 'Package' }); setFormOpen(true); };
  const openEdit = (row) => {
    setForm({
      id: row.id || row._id,
      name: row.name,
      type: row.type,
      icon: row.icon,
      color: row.color,
      keywords: (row.keywords || []).join(', '),
      monthlyBudgetHint: row.monthlyBudgetHint ?? '',
    });
    setFormOpen(true);
  };

  const submit = () => {
    const clean = {
      name: form.name.trim(),
      type: form.type,
      icon: form.icon,
      color: form.color,
      keywords: form.keywords.split(',').map((word) => word.trim().toLowerCase()).filter(Boolean),
      monthlyBudgetHint: Number(form.monthlyBudgetHint) || 0,
    };
    if (clean.name.length < 2) {
      toast.error('Give the category a name', { description: 'At least 2 characters.' });
      return;
    }
    saveAction.run(form.id ? { ...clean, id: form.id } : clean);
  };

  return (
    <>
      <PageHeader
        title="Default categories"
        description="These templates are cloned into every new student account. Editing a template never rewrites existing student data."
        crumbs={[{ label: 'Categories' }]}
        icon={Tag}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={ShieldPlus} onClick={() => setApplyOpen(true)}>
              Apply to all students
            </Button>
            <Button size="sm" icon={Plus} onClick={openCreate}>New default</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Templates', value: templates.length, hint: 'available to new students' },
          { label: 'Expense / income', value: `${stats.expense} / ${stats.income}`, hint: 'split by type' },
          { label: 'Archived', value: stats.archived, hint: 'hidden from new accounts' },
          { label: 'Student copies', value: stats.studentsUsing, hint: 'categories across students' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">{stat.label}</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular text-ink">{stat.value}</p>
            <p className="mt-0.5 text-2xs text-ink-soft">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search names and keywords…"
              className="cc-input pl-10"
              aria-label="Search default categories"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Category type"
              size="sm"
              value={filters.type}
              onChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
            <Segmented
              ariaLabel="Archive state"
              size="sm"
              value={filters.archived}
              onChange={(value) => setFilters((prev) => ({ ...prev, archived: value }))}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
                { value: 'all', label: 'Both' },
              ]}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card className="divide-y divide-surface-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-2.5 w-1/2" /></div>
            </div>
          ))}
        </Card>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tag}
            title="No default categories match"
            description="Adjust the filters, or add a new default that every student will receive."
            action={<Button size="sm" icon={Plus} onClick={openCreate}>New default</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="cc-scroll-x">
            <table className="cc-table">
              <thead>
                <tr>
                  <th className="cc-th">Category</th>
                  <th className="cc-th">Type</th>
                  <th className="cc-th">Keywords</th>
                  <th className="cc-th text-right">Budget hint</th>
                  <th className="cc-th text-right">Student copies</th>
                  <th className="cc-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id || row._id} className="cc-tr">
                    <td className="cc-td">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                          style={{ background: `${row.color}22`, color: row.color }}
                        >
                          <CategoryIcon name={row.icon} className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-ink">{row.name}</span>
                          <span className="block text-2xs text-ink-soft">
                            {row.isDefault ? 'default template' : 'custom template'}
                            {row.isArchived ? ' · archived' : ''}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="cc-td">
                      <Badge tone={row.type === 'income' ? 'success' : 'brand'}>{row.type}</Badge>
                    </td>
                    <td className="cc-td">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {(row.keywords || []).slice(0, 4).map((word) => (
                          <span key={word} className="rounded-full bg-ink-soft/12 px-2 py-0.5 text-2xs text-ink-muted">{word}</span>
                        ))}
                        {(row.keywords || []).length > 4 && (
                          <span className="text-2xs text-ink-soft">+{row.keywords.length - 4}</span>
                        )}
                        {!(row.keywords || []).length && <span className="text-2xs text-ink-soft">—</span>}
                      </div>
                    </td>
                    <td className="cc-td text-right tabular text-xs text-ink-muted">
                      {row.monthlyBudgetHint ? formatMoney(row.monthlyBudgetHint, '', { decimals: 0 }) : '—'}
                    </td>
                    <td className="cc-td text-right">
                      <span className="inline-flex items-center gap-1.5 tabular text-xs text-ink-muted">
                        <Users className="h-3.5 w-3.5" />
                        {row.studentsUsing ?? 0}
                      </span>
                    </td>
                    <td className="cc-td">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(row)}>Edit</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={row.isArchived ? ArchiveRestore : Archive}
                          loading={archiveAction.isRunning}
                          onClick={() => archiveAction.run({ id: row.id || row._id, isArchived: !row.isArchived })}
                        >
                          {row.isArchived ? 'Restore' : 'Archive'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500"
                          icon={Trash2}
                          onClick={() => setDeleteTarget(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Create / edit ──────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? `Edit ${form.name || 'default category'}` : 'New default category'}
        description="Students receive a copy of this template when they sign up."
        icon={Tag}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button loading={saveAction.isRunning} onClick={submit}>{form.id ? 'Save changes' : 'Add default'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="cc-label">Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="cc-input"
                placeholder="e.g. Printing & Stationery"
              />
            </label>
            <label className="block">
              <span className="cc-label">Type</span>
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                className="cc-input"
                disabled={Boolean(form.id)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
          </div>

          <div>
            <span className="cc-label">Icon</span>
            <div className="flex flex-wrap gap-2">
              {options.icons.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, icon: iconName }))}
                  className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                    form.icon === iconName ? 'border-brand-500 bg-brand-500/12 text-brand-500' : 'border-surface-border text-ink-muted hover:border-brand-500/40'
                  }`}
                  aria-label={iconName}
                  aria-pressed={form.icon === iconName}
                >
                  <CategoryIcon name={iconName} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="cc-label">Colour</span>
            <div className="flex flex-wrap gap-2">
              {options.colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  className={`h-8 w-8 rounded-full border-2 transition ${form.color === color ? 'border-ink scale-110' : 'border-transparent'}`}
                  style={{ background: color }}
                  aria-label={`Use ${color}`}
                  aria-pressed={form.color === color}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="cc-label">Keywords (comma separated)</span>
              <input
                value={form.keywords}
                onChange={(event) => setForm((prev) => ({ ...prev, keywords: event.target.value }))}
                className="cc-input"
                placeholder="print, photocopy, stationery"
              />
            </label>
            <label className="block">
              <span className="cc-label">Monthly budget hint</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.monthlyBudgetHint}
                onChange={(event) => setForm((prev) => ({ ...prev, monthlyBudgetHint: event.target.value }))}
                className="cc-input"
                placeholder="0"
              />
            </label>
          </div>

          <p className="rounded-xl border border-surface-border bg-surface-muted p-3 text-2xs leading-relaxed text-ink-soft">
            Changing a template only affects accounts created afterwards. Use “Apply to all students” to push a new default to
            students who already exist.
          </p>
        </div>
      </Modal>

      {/* ── Apply to all ───────────────────────────────────────────── */}
      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Apply defaults to every student?"
        description="Clones any missing default categories into each active student account."
        icon={ShieldPlus}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button loading={applyAction.isRunning} onClick={() => applyAction.run()}>Apply to all students</Button>
          </>
        }
      >
        <ul className="space-y-2 text-sm text-ink-muted">
          <li className="flex gap-2"><Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> Categories a student already has are never duplicated or overwritten.</li>
          <li className="flex gap-2"><Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> Archived templates are skipped.</li>
          <li className="flex gap-2"><Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> The action is safe to run repeatedly and is recorded in the activity feed.</li>
        </ul>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteAction.run(deleteTarget.id || deleteTarget._id)}
        title={`Delete the ${deleteTarget?.name} default?`}
        message="New students will no longer receive this category. Existing student categories are untouched."
        confirmLabel="Delete default"
        tone="danger"
        loading={deleteAction.isRunning}
      />
    </>
  );
}
