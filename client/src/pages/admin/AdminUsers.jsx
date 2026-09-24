import { useState } from 'react';
import {
  Activity, AlertTriangle, ChevronLeft, ChevronRight, Copy, KeyRound, Mail, Search, ShieldOff, ShieldCheck, Users, UserX,
} from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Avatar, Badge, Segmented } from '../../components/ui/Primitives.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { useApi, useApiAction, useDebounced } from '../../hooks/useApi.js';
import { adminApi } from '../../services/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatMoney, formatRelative } from '../../utils/format.js';

const PAGE_SIZE = 10;

export default function AdminUsers() {
  const toast = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all', role: 'all', page: 1 });
  const [detailId, setDetailId] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [disableReason, setDisableReason] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState('');

  const debouncedSearch = useDebounced(filters.search, 350);

  const query = {
    page: filters.page,
    limit: PAGE_SIZE,
    status: filters.status,
    role: filters.role,
    search: debouncedSearch.trim() || undefined,
  };
  const { data, meta: pager, isLoading, error, reload, refresh } = useApi(() => adminApi.users(query), {
    deps: [JSON.stringify(query)],
  });

  const { data: detail, isLoading: detailLoading } = useApi(() => adminApi.user(detailId), {
    deps: [detailId],
    enabled: Boolean(detailId),
  });
  const { data: activity } = useApi(() => adminApi.userActivity(detailId), { deps: [detailId], enabled: Boolean(detailId) });

  const statusAction = useApiAction(({ id, payload }) => adminApi.setUserStatus(id, payload), {
    onSuccess: (response) => {
      toast.success(response.message || 'User updated');
      setStatusTarget(null);
      setDisableReason('');
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not update that account'),
  });

  const resetAction = useApiAction(({ id, password }) => adminApi.resetUserPassword(id, { newPassword: password }), {
    onSuccess: (response, { password }) => {
      setResetTarget(null);
      setRevealPassword(password);
      toast.success(response.message || 'Temporary password set', {
        description: 'Share it with the student — they can change it from their profile.',
      });
    },
    onError: (err) => toast.fromError(err, 'Could not reset that password'),
  });

  const users = data || [];
  const pages = pager || { page: 1, totalPages: 1, total: users.length, hasNextPage: false, hasPrevPage: false };

  const visible = users;

  return (
    <>
      <PageHeader
        title="Users"
        description="Every student account on this deployment. Disabling an account takes effect on their next request."
        crumbs={[{ label: 'Users' }]}
        icon={Users}
        actions={<Button variant="secondary" size="sm" onClick={() => refresh()}>Refresh</Button>}
      />

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
              placeholder="Search students by name or email…"
              className="cc-input pl-10"
              aria-label="Search users"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Account status"
              size="sm"
              value={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value, page: 1 }))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
            />
            <Segmented
              ariaLabel="Role"
              size="sm"
              value={filters.role}
              onChange={(value) => setFilters((prev) => ({ ...prev, role: value, page: 1 }))}
              options={[
                { value: 'all', label: 'All roles' },
                { value: 'student', label: 'Students' },
                { value: 'admin', label: 'Admins' },
              ]}
            />
          </div>
        </div>
        <p className="mt-2.5 text-2xs text-ink-soft">
          {pages.total} account{pages.total === 1 ? '' : 's'} matching these filters · page {pages.page} of {pages.totalPages}
          {debouncedSearch.trim() ? ` · search: “${debouncedSearch.trim()}”` : ''}
        </p>
      </Card>

      {revealPassword && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[.07] px-4 py-3 text-sm">
          <span className="text-ink-muted">
            Temporary password: <code className="rounded bg-ink-soft/12 px-1.5 py-0.5 font-mono text-ink">{revealPassword}</code>
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Copy}
              onClick={() => { navigator.clipboard?.writeText(revealPassword); toast.info('Password copied'); }}
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRevealPassword('')}>Dismiss</Button>
          </span>
        </div>
      )}

      {isLoading ? (
        <Card className="divide-y divide-surface-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-2.5 w-1/4" /></div>
            </div>
          ))}
        </Card>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No accounts match those filters"
            description="Try clearing the search box or switching the status and role filters."
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="cc-scroll-x">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th className="cc-th">Student</th>
                    <th className="cc-th">Year</th>
                    <th className="cc-th text-right">Transactions</th>
                    <th className="cc-th text-right">Volume</th>
                    <th className="cc-th">Last seen</th>
                    <th className="cc-th">Status</th>
                    <th className="cc-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => (
                    <tr key={user.id} className="cc-tr">
                      <td className="cc-td">
                        <button
                          type="button"
                          onClick={() => setDetailId(user.id)}
                          className="flex items-center gap-3 text-left"
                        >
                          <Avatar name={user.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink hover:text-brand-500">{user.name}</span>
                            <span className="block truncate text-2xs text-ink-soft">{user.email}</span>
                          </span>
                        </button>
                      </td>
                      <td className="cc-td text-xs text-ink-muted">{user.academicYear || '—'}</td>
                      <td className="cc-td text-right tabular text-sm">{user.transactionCount}</td>
                      <td className="cc-td text-right tabular text-sm">{formatMoney(user.transactionTotal, '', { decimals: 0 })}</td>
                      <td className="cc-td text-xs text-ink-muted">
                        {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'never'}
                      </td>
                      <td className="cc-td">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'active' : 'disabled'}</Badge>
                          {user.role === 'admin' && <Badge tone="warning">admin</Badge>}
                        </div>
                      </td>
                      <td className="cc-td">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={Activity} onClick={() => setDetailId(user.id)}>
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={KeyRound}
                            onClick={() => { setResetTarget(user); setNewPassword(''); }}
                          >
                            Reset
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={user.isActive ? 'text-rose-500' : 'text-mint-600'}
                            icon={user.isActive ? UserX : ShieldCheck}
                            onClick={() => setStatusTarget(user)}
                          >
                            {user.isActive ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-ink-muted">
              Page <strong className="text-ink">{pages.page}</strong> of <strong className="text-ink">{pages.totalPages}</strong>
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={!pages.hasPrevPage && pages.page <= 1}
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                iconRight={ChevronRight}
                disabled={!pages.hasNextPage}
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail ─────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title={detail?.user?.name || 'Account detail'}
        description={detail?.user?.email}
        icon={Users}
        size="lg"
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={detail.user.isActive ? 'success' : 'danger'}>{detail.user.isActive ? 'active' : 'disabled'}</Badge>
              <Badge tone={detail.user.role === 'admin' ? 'warning' : 'info'}>{detail.user.role}</Badge>
              {detail.user.onboarding?.completed === false && <Badge tone="neutral">onboarding skipped</Badge>}
              {detail.user.streak?.current > 0 && <Badge tone="success">{detail.user.streak.current}-day streak</Badge>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <dl className="rounded-2xl border border-surface-border bg-surface-muted p-3.5 text-xs">
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-soft">Profile</p>
                {[
                  ['Academic year', detail.user.academicYear || '—'],
                  ['University', detail.user.university || '—'],
                  ['Monthly allowance', detail.user.monthlyAllowance ? formatMoney(detail.user.monthlyAllowance, '', { decimals: 0 }) : '—'],
                  ['Savings target', detail.user.savingsGoal ? formatMoney(detail.user.savingsGoal, '', { decimals: 0 }) : '—'],
                  ['Currency', detail.user.preferences?.currency || '—'],
                  ['Member since', detail.usage.memberSince ? new Date(detail.usage.memberSince).toLocaleDateString('en-GB') : '—'],
                ].map(([label, value]) => (
                  <span key={label} className="flex items-center justify-between border-b border-surface-border py-1.5 last:border-0">
                    <span className="text-ink-soft">{label}</span>
                    <span className="font-medium text-ink">{value}</span>
                  </span>
                ))}
              </dl>

              <dl className="rounded-2xl border border-surface-border bg-surface-muted p-3.5 text-xs">
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-soft">Usage</p>
                {[
                  ['Transactions', detail.usage.transactions],
                  ['Categories', detail.usage.categories],
                  ['Budgets', detail.usage.budgets],
                  ['Goals', detail.usage.goals],
                  ['Lifetime income', formatMoney(detail.usage.lifetimeIncome, '', { decimals: 0 })],
                  ['Lifetime expense', formatMoney(detail.usage.lifetimeExpense, '', { decimals: 0 })],
                ].map(([label, value]) => (
                  <span key={label} className="flex items-center justify-between border-b border-surface-border py-1.5 last:border-0">
                    <span className="text-ink-soft">{label}</span>
                    <span className="font-medium text-ink">{value}</span>
                  </span>
                ))}
              </dl>
            </div>

            <div>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-soft">Recent activity</p>
              {!activity?.activity?.length ? (
                <p className="text-xs text-ink-soft">No activity recorded for this account.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {activity.activity.slice(0, 12).map((entry) => (
                    <li key={entry._id} className="flex items-center justify-between gap-3 text-2xs">
                      <span className="min-w-0 truncate text-ink-muted">
                        <strong className="font-medium text-ink">{entry.action}</strong> {entry.entity}
                        {entry.label ? ` · ${entry.label}` : ''}
                      </span>
                      <span className="shrink-0 text-ink-soft">{formatRelative(entry.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-surface-border pt-3.5">
              <Button
                size="sm"
                variant="secondary"
                icon={KeyRound}
                onClick={() => { setResetTarget(detail.user); setNewPassword(''); setDetailId(null); }}
              >
                Reset password
              </Button>
              <Button
                size="sm"
                variant={detail.user.isActive ? 'danger' : 'success'}
                icon={detail.user.isActive ? ShieldOff : ShieldCheck}
                onClick={() => { setStatusTarget(detail.user); setDetailId(null); }}
              >
                {detail.user.isActive ? 'Disable account' : 'Enable account'}
              </Button>
              <a href={`mailto:${detail.user.email}`} className="cc-btn-ghost cc-btn-sm">
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Disable / enable ───────────────────────────────────────── */}
      <Modal
        open={Boolean(statusTarget)}
        onClose={() => { setStatusTarget(null); setDisableReason(''); }}
        title={statusTarget?.isActive ? `Disable ${statusTarget?.name}?` : `Re-enable ${statusTarget?.name}?`}
        description={
          statusTarget?.isActive
            ? 'They lose access immediately on their next request. Their data stays intact.'
            : 'They can sign in again right away with their existing password.'
        }
        icon={statusTarget?.isActive ? AlertTriangle : ShieldCheck}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setStatusTarget(null); setDisableReason(''); }}>Cancel</Button>
            <Button
              variant={statusTarget?.isActive ? 'danger' : 'success'}
              loading={statusAction.isRunning}
              onClick={() =>
                statusAction.run({
                  id: statusTarget.id,
                  payload: { isActive: !statusTarget.isActive, reason: disableReason },
                })
              }
            >
              {statusTarget?.isActive ? 'Disable account' : 'Enable account'}
            </Button>
          </>
        }
      >
        {statusTarget?.isActive ? (
          <label className="block">
            <span className="cc-label">Reason (optional, stored with the account)</span>
            <input
              value={disableReason}
              onChange={(event) => setDisableReason(event.target.value)}
              className="cc-input"
              placeholder="Spam reports / requested by the student / graduated"
            />
          </label>
        ) : (
          <p className="text-sm text-ink-muted">
            {statusTarget?.disabledReason ? `Originally disabled because: “${statusTarget.disabledReason}”.` : 'No reason was recorded when the account was disabled.'}
          </p>
        )}
      </Modal>

      {/* ── Reset password ─────────────────────────────────────────── */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Reset password for ${resetTarget?.name}`}
        description="Set a temporary password and share it with the student. They can change it from their profile."
        icon={KeyRound}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button
              loading={resetAction.isRunning}
              icon={KeyRound}
              onClick={() => resetAction.run({ id: resetTarget.id, password: newPassword })}
            >
              Set password
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="cc-label">Temporary password</span>
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="cc-input font-mono"
              placeholder="At least 8 characters"
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            icon={Copy}
            onClick={() => {
              const generated = `Campus${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
              setNewPassword(generated);
              toast.info('Password suggestion ready', { description: 'Press “Set password” to apply it.' });
            }}
          >
            Generate a strong password
          </Button>
          <p className="text-2xs leading-relaxed text-ink-soft">
            Resetting a password invalidates that student's existing sessions, so they will need to sign in again.
          </p>
        </div>
      </Modal>
    </>
  );
}
