import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogIn, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react';

import { Logo } from '../../components/ui/Brand.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Shown when a signed-in student tries to open an admin route. The API refuses
 * these requests too — this page is the friendly explanation, not the defence.
 */
export default function Unauthorized() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const switchAccount = async () => {
    await logout();
    toast.info('Signed out', { description: 'Sign in with an administrator account to open the admin panel.' });
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center"><Logo size={40} /></div>

        <div className="rounded-3xl border border-surface-border bg-surface p-6 text-center shadow-card sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/14 text-amber-500">
            <ShieldAlert className="h-6 w-6" />
          </span>

          <h1 className="mt-4 font-display text-2xl font-bold text-ink">This area is for administrators</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            {isAuthenticated
              ? 'Your account does not carry the admin role, so the control panel is off limits. Every admin API route checks your role on the server as well.'
              : 'You need to sign in with an administrator account to open this page.'}
          </p>

          {isAuthenticated && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface-muted px-3.5 py-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-mint-500" />
              <span className="text-ink-muted">Signed in as</span>
              <span className="font-medium text-ink">{user?.name}</span>
              <Badge tone={isAdmin ? 'warning' : 'neutral'}>{user?.role}</Badge>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {isAuthenticated && !isAdmin && (
              <Link to="/dashboard" className="cc-btn-primary">
                <LayoutDashboard className="h-4 w-4" />
                Go to my dashboard
              </Link>
            )}
            {isAdmin ? (
              <Link to="/admin/dashboard" className="cc-btn-primary">
                <ShieldCheck className="h-4 w-4" />
                Open the admin panel
              </Link>
            ) : (
              <button type="button" onClick={switchAccount} className="cc-btn-secondary">
                <UserCog className="h-4 w-4" />
                Sign in as an administrator
              </button>
            )}
            {!isAuthenticated && (
              <Link to="/login" className="cc-btn-secondary">
                <LogIn className="h-4 w-4" />
                Student sign-in
              </Link>
            )}
          </div>

          <p className="mt-5 text-2xs leading-relaxed text-ink-soft">
            Demo administrator: <code className="rounded bg-ink-soft/12 px-1.5 py-0.5 font-mono">admin@campuscoin.com</code> ·
            <code className="ml-1 rounded bg-ink-soft/12 px-1.5 py-0.5 font-mono">AdminCoin123</code>
          </p>
        </div>

        <p className="mt-5 text-center text-2xs text-ink-soft">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Go back to the previous page</Button>
        </p>
      </div>
    </div>
  );
}
