import { useMemo, useState } from 'react';
import {
  CalendarClock, Eye, EyeOff, Link2, Megaphone, Pencil, Plus, Send, Trash2, Users,
} from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Badge, Segmented } from '../../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, SkeletonCard } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { useApi, useApiAction } from '../../hooks/useApi.js';
import { adminApi } from '../../services/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatRelative, toDateInput } from '../../utils/format.js';

const SEVERITIES = [
  { value: 'info', label: 'Info', hint: 'General update, nothing urgent' },
  { value: 'success', label: 'Success', hint: 'Good news — features, milestones' },
  { value: 'warning', label: 'Warning', hint: 'Something needs attention' },
  { value: 'danger', label: 'Critical', hint: 'Outages, data-affecting incidents' },
];

const KINDS = [
  { value: 'general', label: 'General' },
  { value: 'feature', label: 'Feature launch' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'alert', label: 'Alert' },
];

const AUDIENCES = [
  { value: 'all', label: 'All students', hint: 'Everyone with an active account' },
  { value: 'new_users', label: 'New students', hint: 'Onboarded in the last 30 days' },
  { value: 'admins', label: 'Admins only', hint: 'Internal notes, not student-facing' },
];

const EMPTY = {
  id: null, title: '', body: '', kind: 'general', severity: 'info', audience: 'all', link: '', expiresAt: '',
};

export default function AdminAnnouncements() {
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [publishTarget, setPublishTarget] = useState(null);

  const { data, isLoading, error, reload, refresh } = useApi(
    () => adminApi.announcements(status === 'all' ? {} : { status }),
    { deps: [status] },
  );

  const saveAction = useApiAction(
    (payload) =>
      payload.id
        ? adminApi.updateAnnouncement(payload.id, payload)
        : adminApi.createAnnouncement(payload),
    {
      onSuccess: (response, payload) => {
        toast.success(response.message || (payload.publish ? 'Announcement published' : 'Draft saved'));
        setFormOpen(false);
        setForm(EMPTY);
        setPublishTarget(null);
        refresh();
      },
      onError: (err) => toast.fromError(err, 'Could not save that announcement'),
    },
  );

  const toggleAction = useApiAction(({ id, publish }) => adminApi.updateAnnouncement(id, { publish }), {
    onSuccess: (response) => {
      toast.success(response.message || 'Announcement updated');
      setPublishTarget(null);
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not update that announcement'),
  });

  const deleteAction = useApiAction((id) => adminApi.deleteAnnouncement(id), {
    onSuccess: (response) => {
      toast.success(response.message || 'Announcement deleted');
      setDeleteTarget(null);
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not delete that announcement'),
  });

  const announcements = data?.announcements || [];
  const stats = useMemo(
    () => ({
      total: announcements.length,
      published: announcements.filter((row) => row.isPublished).length,
      drafts: announcements.filter((row) => !row.isPublished).length,
      audience: announcements.reduce((sum, row) => sum + (row.stats?.recipients || 0), 0),
    }),
    [announcements],
  );

  const openCreate = () => { setForm(EMPTY); setFormOpen(true); };
  const openEdit = (row) => {
    setForm({
      id: row._id,
      title: row.title,
      body: row.body,
      kind: row.kind || 'general',
      severity: row.severity || 'info',
      audience: row.audience || 'all',
      link: row.link || '',
      expiresAt: toDateInput(row.expiresAt),
    });
    setFormOpen(true);
  };

  const submit = (publish) => {
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      kind: form.kind,
      severity: form.severity,
      audience: form.audience,
      link: form.link.trim(),
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:00`).toISOString() : null,
      publish,
    };
    if (payload.title.length < 3) {
      toast.error('Add a title', { description: 'At least 3 characters.' });
      return;
    }
    if (payload.body.length < 5) {
      toast.error('Write the announcement body', { description: 'At least 5 characters.' });
      return;
    }
    if (form.id) saveAction.run({ ...payload, id: form.id, publish: publish || undefined });
    else saveAction.run(payload);
  };

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Broadcasts appear in every student's notification centre and on the dashboard banner while they are live."
        crumbs={[{ label: 'Announcements' }]}
        icon={Megaphone}
        actions={<Button size="sm" icon={Plus} onClick={openCreate}>New announcement</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, hint: 'all announcements' },
          { label: 'Published', value: stats.published, hint: 'visible to students' },
          { label: 'Drafts', value: stats.drafts, hint: 'not yet sent' },
          { label: 'Recipients', value: stats.audience, hint: 'accounts targeted' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-2xs uppercase tracking-wide text-ink-soft">{stat.label}</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular text-ink">{stat.value}</p>
            <p className="mt-0.5 text-2xs text-ink-soft">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented
          ariaLabel="Announcement status"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Drafts' },
          ]}
        />
        <Button variant="secondary" size="sm" onClick={() => refresh()}>Refresh</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : announcements.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description="Publish a welcome note, a maintenance window, or a feature launch — students see it instantly."
            action={<Button size="sm" icon={Plus} onClick={openCreate}>New announcement</Button>}
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {announcements.map((row) => {
            const severity = SEVERITIES.find((entry) => entry.value === row.severity) || SEVERITIES[0];
            return (
              <li key={row._id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-ink">{row.title}</h3>
                        <Badge tone={row.isPublished ? 'success' : 'neutral'}>{row.isPublished ? 'published' : 'draft'}</Badge>
                        <Badge tone={row.severity === 'danger' ? 'danger' : row.severity === 'warning' ? 'warning' : row.severity === 'success' ? 'success' : 'info'}>
                          {severity.label}
                        </Badge>
                        <Badge tone="neutral">{row.kind || 'general'}</Badge>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{row.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-soft">
                        <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" /> {row.audience || 'all'}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3 w-3" />
                          {row.publishedAt ? `published ${formatRelative(row.publishedAt)}` : `created ${formatRelative(row.createdAt)}`}
                        </span>
                        {row.expiresAt && <span>expires {toDateInput(row.expiresAt)}</span>}
                        <span>by {row.createdBy?.name || 'unknown'}</span>
                        <span className="inline-flex items-center gap-1.5"><Send className="h-3 w-3" /> {row.stats?.recipients || 0} recipients</span>
                        {row.link && (
                          <a href={row.link} target="_blank" rel="noreferrer" className="cc-link inline-flex items-center gap-1.5">
                            <Link2 className="h-3 w-3" /> {row.link}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(row)}>Edit</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={row.isPublished ? EyeOff : Eye}
                        onClick={() => setPublishTarget(row)}
                      >
                        {row.isPublished ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-rose-500" icon={Trash2} onClick={() => setDeleteTarget(row)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Composer ───────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Edit announcement' : 'New announcement'}
        description="Published announcements appear immediately in the student notification centre."
        icon={Megaphone}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="secondary" loading={saveAction.isRunning} onClick={() => submit(false)}>Save draft</Button>
            <Button icon={Send} loading={saveAction.isRunning} onClick={() => submit(true)}>Publish now</Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="cc-label">Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="cc-input"
              maxLength={120}
              placeholder="Scheduled maintenance on Sunday"
            />
          </label>

          <label className="block">
            <span className="cc-label">Message</span>
            <textarea
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              rows={5}
              maxLength={1200}
              className="cc-input resize-y"
              placeholder="Campus Coin will be read-only between 2 and 4 am while we upgrade the reports engine."
            />
            <span className="mt-1 block text-2xs text-ink-soft">{form.body.length}/1200 characters</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="cc-label">Kind</span>
              <select value={form.kind} onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))} className="cc-input">
                {KINDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="cc-label">Expires (optional)</span>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                className="cc-input"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="cc-label">Severity</span>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    onClick={() => setForm((prev) => ({ ...prev, severity: option.value }))}
                    className={`rounded-xl border px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide transition ${
                      form.severity === option.value
                        ? 'border-brand-500 bg-brand-500/12 text-brand-500'
                        : 'border-surface-border text-ink-muted hover:border-brand-500/40'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="cc-label">Audience</span>
              <div className="space-y-2">
                {AUDIENCES.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="radio"
                      name="audience"
                      checked={form.audience === option.value}
                      onChange={() => setForm((prev) => ({ ...prev, audience: option.value }))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-medium text-ink">{option.label}</span>
                      <span className="block text-2xs text-ink-soft">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label className="block">
            <span className="cc-label">Link (optional)</span>
            <input
              value={form.link}
              onChange={(event) => setForm((prev) => ({ ...prev, link: event.target.value }))}
              className="cc-input"
              placeholder="https://…"
            />
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(publishTarget)}
        onClose={() => setPublishTarget(null)}
        onConfirm={() => toggleAction.run({ id: publishTarget._id, publish: !publishTarget.isPublished })}
        title={publishTarget?.isPublished ? 'Unpublish this announcement?' : 'Publish this announcement?'}
        message={
          publishTarget?.isPublished
            ? 'It disappears from student notification centres straight away. The record is kept as a draft.'
            : 'Every student in the selected audience will see it in their notification centre.'
        }
        confirmLabel={publishTarget?.isPublished ? 'Unpublish' : 'Publish'}
        tone={publishTarget?.isPublished ? 'warning' : 'brand'}
        loading={toggleAction.isRunning}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteAction.run(deleteTarget._id)}
        title={`Delete “${deleteTarget?.title}”?`}
        message="This removes the announcement permanently. Copies already delivered to students are kept in their own notification history."
        confirmLabel="Delete announcement"
        tone="danger"
        loading={deleteAction.isRunning}
      />
    </>
  );
}
