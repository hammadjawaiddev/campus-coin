import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { authApi } from '../../services/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { applySession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  // Validate the token before showing the form so expired links fail clearly.
  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!token) {
        setChecking(false);
        setFormError('This reset link is missing its token. Please request a new one.');
        return;
      }
      try {
        const response = await authApi.verifyResetToken(token);
        if (!active) return;
        setValid(true);
        setEmail(response.data.email);
      } catch (error) {
        if (!active) return;
        setFormError(error.message);
      } finally {
        if (active) setChecking(false);
      }
    };
    verify();
    return () => { active = false; };
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (form.password.length < 8) next.password = 'Use at least 8 characters';
    else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) next.password = 'Include at least one letter and one number';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setFormError('');
    try {
      const response = await authApi.resetPassword({ token, password: form.password });
      applySession(response.data.token, response.data.user);
      toast.success('Password updated', { description: 'You are signed in with your new password.' });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <p className="text-sm text-ink-muted">Checking your reset link…</p>;
  }

  if (!valid) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/8 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-ink">This link cannot be used</p>
            <p className="mt-1 leading-relaxed text-ink-muted">{formError}</p>
          </div>
        </div>
        <Link to="/forgot-password" className="cc-btn-primary w-full">
          Request a new link
        </Link>
        <Link to="/login" className="cc-btn-ghost cc-btn-sm inline-flex">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-3.5 py-2.5 text-xs text-ink-muted">
        Resetting the password for <strong className="text-ink">{email}</strong>
      </div>

      {formError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {formError}
        </div>
      )}

      <label className="block">
        <span className="cc-label">New password</span>
        <input
          type="password"
          value={form.password}
          onChange={(event) => { setForm((prev) => ({ ...prev, password: event.target.value })); setErrors((prev) => ({ ...prev, password: undefined })); }}
          autoComplete="new-password"
          className={`cc-input ${errors.password ? 'cc-input-error' : ''}`}
          placeholder="At least 8 characters"
          required
        />
        {errors.password && <span className="cc-error-text">{errors.password}</span>}
      </label>

      <label className="block">
        <span className="cc-label">Confirm new password</span>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(event) => { setForm((prev) => ({ ...prev, confirmPassword: event.target.value })); setErrors((prev) => ({ ...prev, confirmPassword: undefined })); }}
          autoComplete="new-password"
          className={`cc-input ${errors.confirmPassword ? 'cc-input-error' : ''}`}
          required
        />
        {errors.confirmPassword && <span className="cc-error-text">{errors.confirmPassword}</span>}
      </label>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs">
        {[
          { ok: form.password.length >= 8, label: '8+ characters' },
          { ok: /[a-zA-Z]/.test(form.password), label: 'a letter' },
          { ok: /\d/.test(form.password), label: 'a number' },
        ].map(({ ok, label }) => (
          <li key={label} className={`inline-flex items-center gap-1 ${ok ? 'text-mint-600 dark:text-mint-400' : 'text-ink-soft'}`}>
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>

      <Button type="submit" className="w-full" loading={loading} icon={KeyRound}>
        Update password & sign in
      </Button>
    </form>
  );
}
