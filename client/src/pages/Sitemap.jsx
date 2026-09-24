import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { PublicFooter } from '../layouts/PublicLayout.jsx';
import Logo, { LogoMark } from '../components/ui/Brand.jsx';
import Button from '../components/ui/Button.jsx';
import SitemapTree from '../components/SitemapTree.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Standalone sitemap page (`/sitemap`) — same tree as the landing-page section,
 * plus a quick jump list for keyboard and screen-reader users.
 */
export default function Sitemap() {
  const { isAuthenticated, isAdmin, user } = useAuth();

  const quickLinks = useMemo(
    () => [
      { label: 'Dashboard overview', to: '/dashboard', locked: true },
      { label: 'Add a transaction', to: '/add-transaction', locked: true },
      { label: 'Transaction history', to: '/transactions', locked: true },
      { label: 'Budgets', to: '/budgets', locked: true },
      { label: 'Savings goals', to: '/goals', locked: true },
      { label: 'Reports & exports', to: '/reports', locked: true },
      { label: 'Insights & tips', to: '/insights', locked: true },
      { label: 'Categories', to: '/categories', locked: true },
      { label: 'CSV import', to: '/import', locked: true },
      { label: 'Bookmarks', to: '/bookmarks', locked: true },
      { label: 'Notifications', to: '/notifications', locked: true },
      { label: 'Settings', to: '/settings', locked: true },
    ],
    [],
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-surface-border">
        <div className="cc-section flex h-16 items-center justify-between">
          <Logo size={36} />
          <div className="flex items-center gap-2">
            <Link to="/" className="cc-btn-ghost cc-btn-sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back home
            </Link>
            {isAuthenticated ? (
              <Link to={isAdmin ? '/admin/dashboard' : '/dashboard'} className="cc-btn-primary cc-btn-sm">
                Open dashboard
              </Link>
            ) : (
              <Link to="/login" className="cc-btn-primary cc-btn-sm">
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="cc-section py-12">
        <div className="mx-auto max-w-2xl text-center">
          <span className="cc-badge-info">Sitemap</span>
          <h1 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Everything inside Campus Coin
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Three branches: the public marketing site, the student application (signed in) and the administrator control panel
            (separate role-protected area).
          </p>
        </div>

        <div className="mt-10">
          <SitemapTree />
        </div>

        <section className="mt-12" aria-labelledby="quick-jump">
          <h2 id="quick-jump" className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Quick jump
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm font-medium text-ink transition hover:border-brand-400/60 hover:bg-brand-500/[.05]"
                >
                  {link.label}
                  {link.locked && <Lock className="h-3.5 w-3.5 text-ink-soft" aria-label="Requires sign-in" />}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/admin/login"
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm font-medium text-amber-600 transition hover:bg-amber-500/14 dark:text-amber-400"
              >
                Admin portal
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </section>

        {!isAuthenticated && (
          <div className="mt-14 flex flex-col items-center gap-4 rounded-3xl border border-surface-border bg-surface p-8 text-center">
            <LogoMark size={44} animated />
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              Signed-in pages are shown here for completeness. Sign in with the demo student account to explore them with real
              seeded data — {user?.email || 'demo@campuscoin.com'}.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/login" className="cc-btn-primary">Sign in with demo account</Link>
              <Link to="/register" className="cc-btn-secondary">Create my own</Link>
            </div>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
