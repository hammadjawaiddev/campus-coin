import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, MailCheck, Send } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { authApi } from '../../services/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Password reset request.
 * When SMTP is not configured on the server, the API returns a development-only
 * reset link which we surface here (clearly marked) so the flow is demoable.
 */
export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authApi.forgotPassword({ email: email.trim() });
      setResult(response.data);
      toast.success('Request received', { description: response.message });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-mint-500/30 bg-mint-500/8 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-ink">Check your inbox</p>
            <p className="mt-1 leading-relaxed text-ink-muted">
              If <strong>{email}</strong> is registered, a reset link is on its way. It expires in{' '}
              {result.expiresInMinutes || 30} minutes and can be used once.
            </p>
          </div>
        </div>

        {result.devResetUrl && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Development mode · email not configured
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              This server has no SMTP credentials, so instead of sending mail the reset link is returned here and written to the
              API log. Add <code className="rounded bg-ink-soft/12 px-1">EMAIL_*</code> variables to send real email.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" icon={Copy} variant="secondary" onClick={() => { navigator.clipboard?.writeText(result.devResetUrl); toast.info('Reset link copied'); }}>
                Copy link
              </Button>
              <a href={result.devResetUrl} className="cc-btn-primary cc-btn-sm">
                Open reset page
              </a>
            </div>
          </div>
        )}

        <Link to="/login" className="cc-btn-ghost cc-btn-sm inline-flex">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <label className="block">
        <span className="cc-label">Email address</span>
        <input
          type="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setError(''); }}
          autoComplete="email"
          placeholder="you@university.edu"
          className={`cc-input ${error ? 'cc-input-error' : ''}`}
          required
        />
      </label>

      <Button type="submit" className="w-full" loading={loading} icon={Send}>
        Send reset link
      </Button>

      <Link to="/login" className="cc-btn-ghost cc-btn-sm inline-flex">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </form>
  );
}
