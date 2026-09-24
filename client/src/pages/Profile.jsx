import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, CalendarDays, Check, Flame, GraduationCap, Info, KeyRound, Mail, PiggyBank, Save, ShieldCheck,
  Trash2, User, Wallet,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Avatar, Badge } from '../components/ui/Primitives.jsx';
import { ErrorState, SkeletonCard } from '../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { authApi, userApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatRelative } from '../utils/format.js';

const ACADEMIC_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Postgraduate', 'Other'];
const AVATAR_COLORS = ['#6D5DFB', '#0EA5E9', '#22C55E', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6'];

const ACTIVITY_LABELS = {
  create: 'Added',
  update: 'Updated',
  delete: 'Deleted',
  import: 'Imported',
  ai: 'Generated',
  login: 'Signed in',
  view: 'Viewed',
};

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const { data: summary, isLoading: summaryLoading, error: summaryError, reload } = useApi(() => userApi.summary(), { deps: [] });
  const { data: activity, refresh: refreshActivity } = useApi(() => userApi.activity(), { deps: [] });

  const [form, setForm] = useState({
    name: '',
    email: '',
    academicYear: '1st Year',
    monthlyAllowance: '',
    savingsGoal: '',
    avatarColor: AVATAR_COLORS[0],
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      email: user.email || '',
      academicYear: user.academicYear || '1st Year',
      monthlyAllowance: user.monthlyAllowance ? String(user.monthlyAllowance) : '',
      savingsGoal: user.savingsGoal ? String(user.savingsGoal) : '',
      avatarColor: user.avatar?.color || AVATAR_COLORS[0],
    });
  }, [user]);

  const saveProfile = useApiAction((payload) => userApi.update(payload), {
    onSuccess: () => {
      toast.success('Profile updated');
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not save your profile'),
  });

  const changePassword = useApiAction((payload) => authApi.changePassword(payload), {
    onSuccess: (response) => {
      toast.success(response.message || 'Password changed', { description: 'Use your new password next time you sign in.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => {
      if (Array.isArray(err.details)) {
        setPasswordErrors(Object.fromEntries(err.details.map((detail) => [detail.field, detail.message])));
      }
      toast.fromError(err, 'Could not change your password');
    },
  });

  const digestAction = useApiAction(() => userApi.sendDigest(), {
    onSuccess: (response) => {
      toast.success(response.message || 'Digest sent', {
        description: response.data?.preview ? 'Email not configured — the digest was logged on the server.' : undefined,
      });
    },
    onError: (err) => toast.fromError(err, 'Could not send the digest'),
  });

  const deactivateAction = useApiAction((payload) => userApi.deactivate(payload), {
    onSuccess: () => toast.info('Account deactivated', { description: 'You have been signed out.' }),
    onError: (err) => toast.fromError(err, 'Could not deactivate the account'),
  });

  const submitProfile = (event) => {
    event.preventDefault();
    saveProfile.run({
      name: form.name.trim(),
      email: form.email.trim(),
      academicYear: form.academicYear,
      monthlyAllowance: Number(form.monthlyAllowance) || 0,
      savingsGoal: Number(form.savingsGoal) || 0,
      avatar: { color: form.avatarColor },
    });
  };

  const submitPassword = (event) => {
    event.preventDefault();
    const errors = {};
    if (!passwordForm.currentPassword) errors.currentPassword = 'Enter your current password';
    if (passwordForm.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters';
    else if (!/[a-zA-Z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) {
      errors.newPassword = 'Include at least one letter and one number';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;
    changePassword.run({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
  };

  return (
    <>
      <PageHeader
        title="Your profile"
        description="Personal details, your income baseline and account security."
        crumbs={[{ label: 'Profile' }]}
        icon={User}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        {/* ── Identity card ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar name={user?.name} color={form.avatarColor} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-ink">{user?.name}</p>
                <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone={user?.role === 'admin' ? 'warning' : 'info'}>{user?.role === 'admin' ? 'administrator' : 'student'}</Badge>
                  <Badge tone="neutral">{user?.academicYear || 'Student'}</Badge>
                </div>
              </div>
            </div>

            <div>
              <span className="cc-label mt-4">Avatar colour</span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, avatarColor: color }))}
                    aria-pressed={form.avatarColor === color}
                    aria-label={`Use ${color} as avatar colour`}
                    className={`h-7 w-7 rounded-full border-2 transition ${form.avatarColor === color ? 'scale-110 border-ink' : 'border-transparent'}`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <ul className="mt-4 space-y-2 border-t border-surface-border pt-4 text-xs">
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  Logging streak
                </span>
                <span className="font-medium text-ink">
                  {user?.streak?.current || 0} days (best {user?.streak?.longest || 0})
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Member since
                </span>
                <span className="font-medium text-ink">
                  {summary?.memberSince ? new Date(summary.memberSince).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Activity className="h-3.5 w-3.5" />
                  Transactions logged
                </span>
                <span className="font-medium text-ink">{summary?.transactionCount ?? '—'}</span>
              </li>
            </ul>

            {user?.onboarding?.completed === false && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Onboarding not finished</p>
                <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
                  You skipped the setup steps — your dashboard works, but adding an income baseline and a savings target makes the
                  comparisons far more useful.
                </p>
                <Link to="/onboarding" className="cc-btn-secondary cc-btn-sm mt-2">Finish setup</Link>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <CardHeader title="Recent activity" subtitle="Your last actions in Campus Coin" icon={Activity} />
            {!activity?.log?.length ? (
              <p className="text-xs text-ink-soft">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {activity.log.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-ink">
                        <strong className="font-medium">{ACTIVITY_LABELS[entry.action] || entry.action}</strong>{' '}
                        {entry.entity}
                        {entry.label ? ` · ${entry.label}` : ''}
                      </span>
                      <span className="text-2xs text-ink-soft">{formatRelative(entry.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => refreshActivity()}>Refresh activity</Button>
          </Card>
        </div>

        {/* ── Forms ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Personal details" subtitle="Used across your dashboard and reports" icon={GraduationCap} />
            {summaryError ? (
              <ErrorState error={summaryError} onRetry={reload} compact />
            ) : summaryLoading ? (
              <SkeletonCard rows={4} />
            ) : (
              <form onSubmit={submitProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="cc-label">Full name</span>
                    <span className="relative block">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                      <input
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="cc-input pl-10"
                        required
                      />
                    </span>
                  </label>
                  <label className="block">
                    <span className="cc-label">Email</span>
                    <span className="relative block">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                        className="cc-input pl-10"
                        required
                      />
                    </span>
                  </label>
                </div>

                <label className="block">
                  <span className="cc-label">Academic year</span>
                  <select
                    value={form.academicYear}
                    onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))}
                    className="cc-select"
                  >
                    {ACADEMIC_YEARS.map((year) => <option key={year}>{year}</option>)}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="cc-label">Monthly income baseline</span>
                    <span className="relative block">
                      <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                      <input
                        type="number"
                        min="0"
                        value={form.monthlyAllowance}
                        onChange={(event) => setForm((prev) => ({ ...prev, monthlyAllowance: event.target.value }))}
                        className="cc-input pl-10"
                        placeholder="350"
                      />
                    </span>
                    <span className="mt-1 block text-2xs text-ink-soft">Powers the “unspent allowance” and savings-rate figures.</span>
                  </label>
                  <label className="block">
                    <span className="cc-label">Savings target</span>
                    <span className="relative block">
                      <PiggyBank className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                      <input
                        type="number"
                        min="0"
                        value={form.savingsGoal}
                        onChange={(event) => setForm((prev) => ({ ...prev, savingsGoal: event.target.value }))}
                        className="cc-input pl-10"
                        placeholder="1200"
                      />
                    </span>
                    <span className="mt-1 block text-2xs text-ink-soft">Compared against your goal balances on the savings screen.</span>
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" icon={Save} loading={saveProfile.isRunning}>Save changes</Button>
                  <span className="text-2xs text-ink-soft">Changes apply immediately across the app.</span>
                </div>
              </form>
            )}
          </Card>

          <Card className="p-5">
            <CardHeader title="Security" subtitle="Change your password" icon={KeyRound} />
            <form onSubmit={submitPassword} className="space-y-4">
              <label className="block">
                <span className="cc-label">Current password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => { setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value })); setPasswordErrors({}); }}
                  className={`cc-input ${passwordErrors.currentPassword ? 'cc-input-error' : ''}`}
                  required
                />
                {passwordErrors.currentPassword && <span className="cc-error-text">{passwordErrors.currentPassword}</span>}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="cc-label">New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(event) => { setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value })); setPasswordErrors({}); }}
                    className={`cc-input ${passwordErrors.newPassword ? 'cc-input-error' : ''}`}
                    required
                  />
                  {passwordErrors.newPassword && <span className="cc-error-text">{passwordErrors.newPassword}</span>}
                </label>
                <label className="block">
                  <span className="cc-label">Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => { setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value })); setPasswordErrors({}); }}
                    className={`cc-input ${passwordErrors.confirmPassword ? 'cc-input-error' : ''}`}
                    required
                  />
                  {passwordErrors.confirmPassword && <span className="cc-error-text">{passwordErrors.confirmPassword}</span>}
                </label>
              </div>

              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs">
                {[
                  { ok: passwordForm.newPassword.length >= 8, label: '8+ characters' },
                  { ok: /[a-zA-Z]/.test(passwordForm.newPassword), label: 'a letter' },
                  { ok: /\d/.test(passwordForm.newPassword), label: 'a number' },
                ].map(({ ok, label }) => (
                  <li key={label} className={`inline-flex items-center gap-1 ${ok ? 'text-mint-600 dark:text-mint-400' : 'text-ink-soft'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>

              <Button type="submit" variant="secondary" icon={ShieldCheck} loading={changePassword.isRunning}>
                Change password
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <CardHeader title="Email & data" subtitle="Digests and account removal" icon={Mail} />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" icon={Mail} loading={digestAction.isRunning} onClick={() => digestAction.run()}>
                Send me a digest now
              </Button>
              <Button variant="ghost" size="sm" icon={Trash2} className="text-rose-500" onClick={() => setConfirmDeactivate(true)}>
                Deactivate my account
              </Button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-ink-soft">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              If SMTP is not configured on the server, email actions are logged instead of sent — the button still performs a real
              request and tells you which happened.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => { setConfirmDeactivate(false); setDeactivatePassword(''); }}
        onConfirm={() => deactivateAction.run({ password: deactivatePassword })}
        loading={deactivateAction.isRunning}
        title="Deactivate your account?"
        message="Your profile is disabled immediately and you will be signed out. Your transactions are kept, so an administrator can restore the account if you change your mind."
        confirmLabel="Deactivate account"
        children={
          <label className="mt-3 block">
            <span className="cc-label">Confirm your password</span>
            <input
              type="password"
              value={deactivatePassword}
              onChange={(event) => setDeactivatePassword(event.target.value)}
              className="cc-input"
              placeholder="Your password"
              autoComplete="current-password"
            />
          </label>
        }
      />
    </>
  );
}
