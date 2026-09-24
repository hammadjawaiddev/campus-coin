import { Navigate, useLocation } from 'react-router-dom';
import { LogoMark } from './ui/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Client-side guard — a UX convenience only.
 * Every API route is independently protected by JWT + ownership checks on the
 * server, so bypassing this component reveals nothing.
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { status, isAdmin, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <LogoMark size={48} animated />
        <p className="text-sm text-ink-muted">Checking your session…</p>
      </div>
    );
  }

  if (status !== 'authenticated') {
    const redirect = requireAdmin ? '/admin/login' : '/login';
    return <Navigate to={redirect} state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Nudge brand-new accounts through onboarding once.
  if (!requireAdmin && user && user.onboarding && user.onboarding.completed === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
