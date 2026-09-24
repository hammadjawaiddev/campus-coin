import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, ShieldCheck, ShieldAlert } from 'lucide-react';

import Button from '../../components/ui/Button.jsx';
import { Logo } from '../../components/ui/Brand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Dedicated admin sign-in. It uses the same /api/auth/login endpoint as
 * students (identical JWT, role = admin) but refuses to move forward unless the
 * signed-in account actually carries the admin role — the server enforces the
 * same rule on every /api/admin route.
 */
export default function AdminLogin() {
  const { login, status, isAuthenticated, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-950 text-slate-200">
        <p className="text-sm">Checking your session…</p>
      </div>
    );
  }

  if (isAuthenticated && isAdmin) {
    return <Navigate to={location.state?.from?.pathname || '/admin/dashboard'} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const signedIn = await login({ email: form.email.trim(), password: form.password });
      if (signedIn?.role !== 'admin') {
        navigate('/dashboard', { replace: true });
        toast.info('Signed in as a student', { description: 'This account has no admin privileges, so you were taken to the app.' });
        return;
      }
      toast.success(`Welcome back, ${signedIn.name.split(' ')[0]}`, { description: 'Admin session started' });
      navigate(location.state?.from?.pathname || '/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Those credentials did not work');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(60% 60% at 20% 10%, rgba(109,93,251,.28), transparent 60%), radial-gradient(50% 50% at 85% 80%, rgba(245,158,11,.22), transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-slate-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the site
        </Link>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-xl sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/15 text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <Logo size={26} to={null} showTagline={false} subtitleClassName="text-slate-400" />
              <p className="mt-0.5 text-2xs font-semibold uppercase tracking-[0.18em] text-amber-400">Administrator sign-in</p>
            </div>
          </div>

          <h1 className="mt-5 font-display text-xl font-bold">Admin control room</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            Manage students, default categories and announcements. Every route behind this screen is protected by
            role-based authorisation on the API, not just by this page.
          </p>

          {isAuthenticated && !isAdmin && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              You are signed in as {user?.email} — a student account. Sign in with an administrator account to continue.
            </p>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <label className="block">
              <span className="mb-1.5 block text-2xs font-semibold uppercase tracking-wide text-slate-400">Admin email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none"
                  placeholder="admin@campuscoin.com"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-2xs font-semibold uppercase tracking-wide text-slate-400">Password</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none"
                  placeholder="••••••••"
                />
              </span>
            </label>

            {error && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={ShieldCheck}>
              Enter the admin panel
            </Button>
          </form>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
            <p className="text-2xs uppercase tracking-wide text-slate-500">Demo administrator</p>
            <button
              type="button"
              onClick={() => setForm({ email: 'admin@campuscoin.com', password: 'AdminCoin123' })}
              className="mt-1.5 w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-amber-400/50"
            >
              admin@campuscoin.com · AdminCoin123 — click to fill
            </button>
          </div>

          <p className="mt-4 text-center text-2xs text-slate-500">
            Student? <Link to="/login" className="text-slate-300 underline underline-offset-2">Use the student sign-in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
