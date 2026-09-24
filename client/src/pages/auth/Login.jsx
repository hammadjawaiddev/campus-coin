import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn, Mail, Sparkles } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const DEMO = { email: 'demo@campuscoin.com', password: 'CampusCoin123' };

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const redirectTo = location.state?.from || '/dashboard';

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  const validate = () => {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (!form.password) next.password = 'Enter your password';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setFormError('');
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`, { description: 'Your dashboard is ready.' });
      navigate(user.role === 'admin' ? '/admin/dashboard' : redirectTo, { replace: true });
    } catch (error) {
      setFormError(error.message);
      if (error.details) {
        setErrors(Object.fromEntries((error.details || []).map((detail) => [detail.field, detail.message])));
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setForm(DEMO);
    setErrors({});
    setFormError('');
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {location.state?.from && (
        <p className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-3.5 py-2.5 text-xs text-ink-muted">
          Sign in to continue to <strong className="text-ink">{location.state.from}</strong>.
        </p>
      )}

      {formError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {formError}
        </div>
      )}

      <label className="block">
        <span className="cc-label">Email address</span>
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@university.edu"
            className={`cc-input pl-10 ${errors.email ? 'cc-input-error' : ''}`}
            aria-invalid={Boolean(errors.email)}
            required
          />
        </span>
        {errors.email && <span className="cc-error-text">{errors.email}</span>}
      </label>

      <label className="block">
        <span className="flex items-center justify-between">
          <span className="cc-label">Password</span>
          <Link to="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-500 hover:underline">
            Forgot password?
          </Link>
        </span>
        <span className="relative block">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            placeholder="••••••••"
            className={`cc-input px-10 ${errors.password ? 'cc-input-error' : ''}`}
            aria-invalid={Boolean(errors.password)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft transition hover:text-ink"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
        {errors.password && <span className="cc-error-text">{errors.password}</span>}
      </label>

      <Button type="submit" className="w-full" loading={loading} icon={LogIn}>
        Sign in
      </Button>

      <button
        type="button"
        onClick={fillDemo}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-400/50 bg-brand-500/[.06] px-4 py-2.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-500/12 dark:text-brand-300"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Use the demo student account
      </button>

      <p className="pt-1 text-center text-sm text-ink-muted">
        New to Campus Coin?{' '}
        <Link to="/register" className="cc-link">
          Create a free account
        </Link>
      </p>

      <p className="text-center text-xs text-ink-soft">
        Administrator?{' '}
        <Link to="/admin/login" className="font-medium text-ink-muted underline-offset-2 hover:text-brand-500 hover:underline">
          Use the admin portal
        </Link>
      </p>
    </form>
  );
}
