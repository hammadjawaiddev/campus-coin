import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Copy, Home, LayoutDashboard, LifeBuoy, RefreshCw, ServerCrash, WifiOff } from 'lucide-react';

import { Logo } from '../../components/ui/Brand.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Fallback screen for unhandled API problems. The error interceptor sends
 * people here via AuthContext's `bootError`, and any page can also push here
 * with `state: { message, status, code }` when a call fails unrecoverably.
 */
export default function ServerError() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { bootError, isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const state = location.state || {};
  const message = state.message || bootError || 'The Campus Coin API did not respond as expected.';
  const status = state.status || null;
  const code = state.code || null;
  const isNetwork = Boolean(state.isNetworkError) || Number(status) === 0;

  const report = [
    `Route: ${location.pathname}`,
    status ? `Status: ${status}` : null,
    code ? `Code: ${code}` : null,
    `Message: ${message}`,
    `Time: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success('Diagnostics copied', { description: 'Paste them anywhere you need to share the details.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not access the clipboard', { description: 'Select the details manually instead.' });
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex justify-center"><Logo size={40} /></div>

        <div className="rounded-3xl border border-surface-border bg-surface p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/14 text-rose-500">
              {isNetwork ? <WifiOff className="h-5 w-5" /> : <ServerCrash className="h-5 w-5" />}
            </span>
            <div>
              <h1 className="font-display text-xl font-bold text-ink">
                {isNetwork ? 'We cannot reach the server' : 'Something broke on our side'}
              </h1>
              <p className="text-xs text-ink-muted">
                {isNetwork
                  ? 'Your connection or the API may be offline. Nothing you saved has been lost.'
                  : 'The request failed before it could finish. Your data is intact — please try again.'}
              </p>
            </div>
            <span className="ml-auto flex gap-2">
              {status ? <Badge tone="danger">HTTP {status}</Badge> : null}
              {code ? <Badge tone="neutral">{code}</Badge> : null}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
              <p className="text-2xs text-ink-soft">
                If this keeps happening, check that the API is running on port 5000 and that MongoDB is up — the README documents
                both in the troubleshooting section.
              </p>
            </div>
            <div className="flex gap-2">
              <Button icon={RefreshCw} onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>

          <details className="mt-5 rounded-2xl border border-surface-border bg-surface-muted p-3.5">
            <summary className="cursor-pointer text-xs font-medium text-ink-muted">Technical details</summary>
            <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-ink/5 p-3 font-mono text-2xs leading-relaxed text-ink-muted dark:bg-white/5">
{report}
            </pre>
            <div className="mt-2.5">
              <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyReport}>
                {copied ? 'Copied' : 'Copy diagnostics'}
              </Button>
            </div>
          </details>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" icon={Home} onClick={() => navigate('/')}>Home</Button>
            {isAuthenticated && (
              <Link to="/dashboard" className="cc-btn-primary">
                <LayoutDashboard className="h-4 w-4" />
                Back to dashboard
              </Link>
            )}
            <Link to="/sitemap" className="cc-btn-ghost">
              <LifeBuoy className="h-4 w-4" />
              Find another page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
