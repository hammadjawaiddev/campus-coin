import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, CloudUpload, Download, FileSpreadsheet, FileUp, Info,
  Loader2, RotateCcw, Sparkles, Trash2, Upload, Wand2, X,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, Toggle } from '../components/ui/Primitives.jsx';
import { EmptyState, ErrorState } from '../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import CategoryIcon from '../components/ui/CategoryIcon.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { importApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol, formatMoney } from '../utils/format.js';

const STEPS = [
  { key: 'upload', label: 'Upload', icon: CloudUpload },
  { key: 'review', label: 'Validate & review', icon: Wand2 },
  { key: 'done', label: 'Summary', icon: BadgeCheck },
];

export default function ImportCsv() {
  const { user } = useAuth();
  const toast = useToast();
  const symbol = currencySymbol(user?.preferences?.currency);
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [undoTarget, setUndoTarget] = useState(null);

  const { data: history, refresh: refreshHistory } = useApi(() => importApi.history(), { deps: [] });

  const uploadAction = useApiAction((file) => importApi.preview(file, setUploadProgress), {
    onSuccess: (response) => {
      setPreview(response.data);
      setRows(
        response.data.rows.map((row) => ({
          ...row,
          categoryId: row.matchedCategoryId || row.suggestedCategory?._id || null,
          suggestedCategoryId: row.suggestedCategory?._id || null,
          skip: !row.valid,
        })),
      );
      setStep('review');
      toast.success(`${response.data.summary.valid} of ${response.data.summary.total} rows ready`, {
        description: response.data.summary.invalid
          ? `${response.data.summary.invalid} row(s) have problems and are excluded.`
          : 'Everything validated cleanly.',
      });
    },
    onError: (err) => setError(err.message),
  });

  const commitAction = useApiAction((payload) => importApi.commit(payload), {
    onSuccess: (response) => {
      setResult(response.data);
      setStep('done');
      refreshHistory();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
      toast.success(response.message || 'Import complete');
    },
    onError: (err) => toast.fromError(err, 'The import could not be completed'),
  });

  const undoAction = useApiAction((batchId) => importApi.undo(batchId), {
    onSuccess: (response) => {
      toast.success(response.message || 'Import rolled back');
      setUndoTarget(null);
      refreshHistory();
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not undo that import'),
  });

  const categories = preview?.categories || [];

  const handleFiles = (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError('Please choose a .csv file (Excel files should be exported as CSV first).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('That file is larger than 5 MB.');
      return;
    }
    setError('');
    setUploadProgress(0);
    uploadAction.run(file);
  };

  /** Load the bundled sample file through the real upload pipeline. */
  const trySample = async () => {
    try {
      setUploadProgress(0);
      const blob = await importApi.sampleBlob();
      const file = new File([blob], 'campus-coin-sample-transactions.csv', { type: 'text/csv' });
      uploadAction.run(file);
    } catch (err) {
      setError('Could not load the bundled sample file. Download it instead and upload it manually.');
    }
  };

  const filteredRows = useMemo(() => {
    if (reviewFilter === 'invalid') return rows.filter((row) => !row.valid);
    if (reviewFilter === 'duplicates') return rows.filter((row) => row.isDuplicate);
    if (reviewFilter === 'review') return rows.filter((row) => row.needsReview);
    return rows;
  }, [rows, reviewFilter]);

  const selected = rows.filter((row) => row.valid && !row.skip);

  const updateRow = (rowNumber, patch) =>
    setRows((prev) => prev.map((row) => (row.rowNumber === rowNumber ? { ...row, ...patch } : row)));

  const applySuggestionsToAll = () => {
    setRows((prev) => prev.map((row) => (row.suggestedCategory ? { ...row, categoryId: row.suggestedCategory._id } : row)));
    toast.info('Suggested categories applied', { description: 'Review the list, then confirm the import.' });
  };

  const confirmImport = () =>
    commitAction.run({
      skipDuplicates,
      rows: rows.map((row) => ({
        rowNumber: row.rowNumber,
        date: row.date,
        amount: row.amount,
        description: row.description,
        notes: row.notes,
        type: row.type,
        categoryId: row.categoryId,
        categoryName: row.csvCategory,
        suggestedCategoryId: row.suggestedCategoryId,
        suggestionSource: row.suggestionSource,
        suggestionConfidence: row.suggestionConfidence,
        skip: row.skip || !row.valid,
        forceDuplicate: row.isDuplicate && !skipDuplicates,
      })),
    });

  const resetFlow = () => {
    setStep('upload');
    setPreview(null);
    setRows([]);
    setResult(null);
    setError('');
    setUploadProgress(0);
    setReviewFilter('all');
  };

  return (
    <>
      <PageHeader
        title="Import transactions from CSV"
        description="Upload a bank or spreadsheet export, validate it, review suggestions and commit — nothing is written until you confirm."
        crumbs={[{ label: 'Import CSV' }]}
        icon={FileUp}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={Download} onClick={() => importApi.downloadTemplate().then(() => toast.success('Template downloaded')).catch((err) => toast.fromError(err, 'Could not download the template'))}>
              Template
            </Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={() => importApi.downloadSample().then(() => toast.success('Sample file downloaded')).catch((err) => toast.fromError(err, 'Could not download the sample'))}>
              Sample CSV
            </Button>
          </>
        }
      />

      {/* Stepper */}
      <ol className="mb-5 flex flex-wrap items-center gap-2">
        {STEPS.map((item, index) => {
          const active = item.key === step;
          const done = STEPS.findIndex((s) => s.key === step) > index;
          return (
            <li key={item.key} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium ${
                  active
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                    : done
                      ? 'border-mint-500/40 bg-mint-500/8 text-mint-700 dark:text-mint-400'
                      : 'border-surface-border text-ink-soft'
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <item.icon className="h-3.5 w-3.5" />}
                {index + 1}. {item.label}
              </span>
              {index < STEPS.length - 1 && <span className="h-px w-6 bg-surface-border" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Step 1: upload ─────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-5">
            <div
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => { event.preventDefault(); setDragActive(false); handleFiles(event.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
                dragActive ? 'border-brand-500 bg-brand-500/[.07]' : 'border-surface-border bg-surface-muted'
              }`}
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/12 text-brand-500">
                {uploadAction.isRunning ? <Loader2 className="h-7 w-7 animate-spin" /> : <CloudUpload className="h-7 w-7" />}
              </span>
              <p className="mt-4 font-semibold text-ink">
                {uploadAction.isRunning ? 'Parsing your file…' : 'Drop your CSV here'}
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
                Columns needed: <code className="rounded bg-ink-soft/12 px-1">date</code>,{' '}
                <code className="rounded bg-ink-soft/12 px-1">amount</code>. Optional:{' '}
                <code className="rounded bg-ink-soft/12 px-1">description</code>,{' '}
                <code className="rounded bg-ink-soft/12 px-1">type</code>,{' '}
                <code className="rounded bg-ink-soft/12 px-1">category</code>,{' '}
                <code className="rounded bg-ink-soft/12 px-1">notes</code>. Up to 5 MB / 2,000 rows.
              </p>

              {uploadAction.isRunning ? (
                <div className="mt-5 w-full max-w-xs">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-soft/15">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="mt-1.5 text-2xs text-ink-soft">{uploadProgress}% uploaded</p>
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button icon={Upload} onClick={() => fileInputRef.current?.click()}>Choose a file</Button>
                  <Button variant="secondary" icon={Sparkles} onClick={trySample}>Try the sample file</Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { title: '1 · Parse', body: 'Headers are detected case-insensitively, in any order.' },
                { title: '2 · Validate', body: 'Bad dates, missing amounts and future dates are flagged, not imported.' },
                { title: '3 · Categorise', body: 'Your CSV category is used if it exists; otherwise the assistant suggests one.' },
              ].map((card) => (
                <div key={card.title} className="rounded-2xl border border-surface-border bg-surface-muted p-3.5">
                  <p className="text-xs font-semibold text-ink">{card.title}</p>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-muted">{card.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-5">
              <CardHeader title="How duplicates are handled" subtitle="You decide, per row" icon={Info} />
              <ul className="space-y-2.5 text-xs leading-relaxed text-ink-muted">
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                  A row is marked as a possible duplicate when the same date, amount and type already exist in your account.
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                  With “skip duplicates” on, those rows are left out; turn it off to import them anyway (useful for split payments).
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                  Every import is tagged with a batch id, so you can roll the whole batch back in one click.
                </li>
              </ul>
            </Card>

            <Card className="p-5">
              <CardHeader title="Previous imports" subtitle={`${history?.batches?.length || 0} batch(es)`} icon={FileSpreadsheet} />
              {!history?.batches?.length ? (
                <p className="text-xs text-ink-soft">Nothing imported yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.batches.slice(0, 5).map((batch) => (
                    <li key={batch.batchId} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-muted p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink">{batch.count} transactions · {formatMoney(batch.total, symbol)}</p>
                        <p className="text-2xs text-ink-soft">
                          {new Date(batch.first).toLocaleString('en-GB')} · batch {String(batch.batchId).slice(0, 8)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" icon={RotateCcw} className="text-rose-500" onClick={() => setUndoTarget(batch)}>
                        Undo
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── Step 2: review ────────────────────────────────────────── */}
      {step === 'review' && preview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Rows read', value: preview.summary.total },
              { label: 'Ready to import', value: preview.summary.valid, tone: 'text-mint-600 dark:text-mint-400' },
              { label: 'Invalid', value: preview.summary.invalid, tone: preview.summary.invalid ? 'text-rose-500' : undefined },
              { label: 'Duplicates', value: preview.summary.duplicates, tone: preview.summary.duplicates ? 'text-amber-500' : undefined },
              { label: 'Needs review', value: preview.summary.needsReview, tone: preview.summary.needsReview ? 'text-amber-500' : undefined },
            ].map((stat) => (
              <Card key={stat.label} className="p-3.5">
                <p className="text-2xs uppercase tracking-wide text-ink-soft">{stat.label}</p>
                <p className={`mt-1 font-display text-xl font-bold tabular ${stat.tone || 'text-ink'}`}>{stat.value}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'all', label: `All (${rows.length})` },
                  { key: 'review', label: `Needs review (${preview.summary.needsReview})` },
                  { key: 'duplicates', label: `Duplicates (${preview.summary.duplicates})` },
                  { key: 'invalid', label: `Invalid (${preview.summary.invalid})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setReviewFilter(tab.key)}
                    className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                      reviewFilter === tab.key ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'border-surface-border text-ink-muted hover:border-brand-400/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-44">
                  <Toggle
                    id="skip-duplicates"
                    checked={skipDuplicates}
                    onChange={setSkipDuplicates}
                    label="Skip duplicates"
                  />
                </div>
                <Button variant="secondary" size="sm" icon={Wand2} onClick={applySuggestionsToAll} disabled={rows.every((row) => !row.suggestedCategory)}>
                  Apply all suggestions
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-soft">
              <span>{preview.filename} · {(preview.sizeBytes / 1024).toFixed(1)} KB</span>
              <span>Detected columns: {preview.columns.detected.join(', ') || '—'}</span>
              <span>
                Assistant: {preview.ai.used ? 'AI-assisted' : preview.ai.configured ? 'rule engine' : 'rule engine (no AI key configured)'}
              </span>
              <span className="font-medium text-ink-muted">{selected.length} row(s) will be imported</span>
            </div>

            {preview.errors?.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/[.06] p-3 text-2xs text-ink-muted">
                {preview.errors.map((message) => (
                  <li key={message} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    {message}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="cc-scroll-x max-h-[560px] overflow-y-auto">
              <table className="cc-table">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr>
                    <th className="cc-th w-10">#</th>
                    <th className="cc-th">Date</th>
                    <th className="cc-th">Description</th>
                    <th className="cc-th">Type</th>
                    <th className="cc-th text-right">Amount</th>
                    <th className="cc-th">Category</th>
                    <th className="cc-th">Flags</th>
                    <th className="cc-th w-16 text-right">Import</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.rowNumber} className={`cc-tr ${!row.valid ? 'bg-rose-500/[.05]' : row.skip ? 'opacity-55' : ''}`}>
                      <td className="cc-td text-2xs text-ink-soft">{row.rowNumber}</td>
                      <td className="cc-td whitespace-nowrap text-xs">
                        {row.date ? new Date(row.date).toLocaleDateString('en-GB') : <span className="text-rose-500">missing</span>}
                      </td>
                      <td className="cc-td max-w-[220px]">
                        <span className="block truncate text-sm">{row.description || <span className="text-ink-soft">—</span>}</span>
                        {row.csvCategory && <span className="text-2xs text-ink-soft">CSV category: {row.csvCategory}</span>}
                      </td>
                      <td className="cc-td">
                        <select
                          value={row.type}
                          onChange={(event) => updateRow(row.rowNumber, { type: event.target.value })}
                          className="cc-select py-1 text-xs"
                          aria-label={`Type for row ${row.rowNumber}`}
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </td>
                      <td className={`cc-td text-right tabular text-sm font-medium ${row.type === 'income' ? 'text-mint-600 dark:text-mint-400' : 'text-ink'}`}>
                        {row.amount ? formatMoney(row.amount, symbol) : <span className="text-rose-500">invalid</span>}
                      </td>
                      <td className="cc-td min-w-[190px]">
                        <select
                          value={row.categoryId || ''}
                          onChange={(event) =>
                            updateRow(row.rowNumber, {
                              categoryId: event.target.value,
                              userOverrodeSuggestion: Boolean(row.suggestedCategoryId) && event.target.value !== row.suggestedCategoryId,
                            })
                          }
                          className="cc-select py-1 text-xs"
                          aria-label={`Category for row ${row.rowNumber}`}
                        >
                          <option value="">Choose a category…</option>
                          {categories
                            .filter((category) => category.type === row.type)
                            .map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>
                        {row.suggestedCategory && (
                          <span className="mt-1 flex items-center gap-1 text-2xs text-ink-soft">
                            <CategoryIcon name={row.suggestedCategory.icon} className="h-3 w-3" />
                            Suggested: {row.suggestedCategory.name}
                            {row.suggestionSource === 'csv_column' ? ' (from your CSV)' : row.suggestionSource === 'ai' ? ' (AI)' : ' (rules)'}
                            {row.userOverrodeSuggestion && ' — overridden by you'}
                          </span>
                        )}
                      </td>
                      <td className="cc-td">
                        <div className="flex flex-wrap gap-1">
                          {row.errors?.map((message) => <Badge key={message} tone="danger">{message}</Badge>)}
                          {row.isDuplicate && <Badge tone="warning">duplicate</Badge>}
                          {row.needsReview && <Badge tone="info">review</Badge>}
                          {row.valid && !row.isDuplicate && !row.needsReview && <Badge tone="success">ok</Badge>}
                        </div>
                      </td>
                      <td className="cc-td text-right">
                        <Toggle
                          id={`import-row-${row.rowNumber}`}
                          checked={!row.skip}
                          onChange={(value) => updateRow(row.rowNumber, { skip: !value })}
                          label=""
                          disabled={!row.valid}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button icon={Upload} loading={commitAction.isRunning} onClick={confirmImport} disabled={selected.length === 0}>
              Import {selected.length} transaction{selected.length === 1 ? '' : 's'}
            </Button>
            <Button variant="secondary" icon={ArrowLeft} onClick={resetFlow} disabled={commitAction.isRunning}>
              Choose a different file
            </Button>
            <p className="text-2xs text-ink-soft">
              {formatMoney(preview.summary.totalAmount, symbol)} in expenses · {formatMoney(preview.summary.totalIncome, symbol)} in income selected
            </p>
          </div>
        </div>
      )}

      {/* ── Step 3: summary ───────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint-500/12 text-mint-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-ink">Import complete</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {result.imported} transaction{result.imported === 1 ? '' : 's'} added worth {formatMoney(result.totalAmount, symbol)}. Budgets,
              insights and notifications were recalculated for the affected months.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Imported', value: result.imported, tone: 'text-mint-600 dark:text-mint-400' },
                { label: 'Skipped', value: result.skipped, tone: 'text-amber-500' },
                { label: 'Failed', value: result.failed, tone: result.failed ? 'text-rose-500' : 'text-ink' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-surface-border bg-surface-muted p-3.5">
                  <p className="text-2xs uppercase tracking-wide text-ink-soft">{stat.label}</p>
                  <p className={`mt-1 font-display text-xl font-bold tabular ${stat.tone}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {(result.skipDetails?.length > 0 || result.failDetails?.length > 0) && (
              <div className="mt-4 space-y-2">
                {result.failDetails?.length > 0 && (
                  <details className="rounded-xl border border-rose-500/25 bg-rose-500/[.05] p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {result.failed} row(s) could not be imported
                    </summary>
                    <ul className="mt-2 space-y-1 text-2xs text-ink-muted">
                      {result.failDetails.map((row) => <li key={row.rowNumber}>Row {row.rowNumber}: {row.reason}</li>)}
                    </ul>
                  </details>
                )}
                {result.skipDetails?.length > 0 && (
                  <details className="rounded-xl border border-surface-border p-3">
                    <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                      {result.skipped} row(s) skipped
                    </summary>
                    <ul className="mt-2 space-y-1 text-2xs text-ink-soft">
                      {result.skipDetails.map((row) => <li key={row.rowNumber}>Row {row.rowNumber}: {row.reason}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/transactions?source=csv`} className="cc-btn-primary cc-btn-sm">
                View imported transactions
              </Link>
              <Button variant="secondary" size="sm" icon={FileUp} onClick={resetFlow}>Import another file</Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-500"
                icon={Trash2}
                loading={undoAction.isRunning}
                onClick={() => undoAction.run(result.importBatch)}
              >
                Undo this import
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="What happens next" subtitle="Your data is already live" icon={Info} />
            <ul className="space-y-3 text-xs leading-relaxed text-ink-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-500" />
                Imported entries are marked with <strong className="text-ink">source: csv</strong> so you can filter them later.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-500" />
                Every row keeps both the suggested category and the category you confirmed, which trains future suggestions.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-500" />
                Duplicate detection also runs on import, so a re-uploaded file will not double your spending.
              </li>
            </ul>
            <Link to="/reports" className="cc-btn-secondary cc-btn-sm mt-4 w-full">Open reports with the new data</Link>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(undoTarget)}
        onClose={() => setUndoTarget(null)}
        onConfirm={() => undoAction.run(undoTarget?.batchId)}
        loading={undoAction.isRunning}
        title="Undo this import?"
        message={`This permanently removes the ${undoTarget?.count || 0} transactions that came from batch ${String(undoTarget?.batchId || '').slice(0, 8)}. Transactions you added manually are untouched.`}
        confirmLabel="Remove imported rows"
      />
    </>
  );
}
