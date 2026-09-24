import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Github, Linkedin, Mail, Menu, Moon, Sun, Twitter, X } from 'lucide-react';
import Logo from '../components/ui/Brand';
import Button from '../components/ui/Button';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useScrolled } from '../hooks/useApi';

const NAV_LINKS = [
  { label: 'Features', to: '/#features' },
  { label: 'How it works', to: '/#how-it-works' },
  { label: 'Benefits', to: '/#benefits' },
  { label: 'FAQ', to: '/#faq' },
  { label: 'Sitemap', to: '/sitemap' },
];

/** Marketing shell: sticky glassy navbar + rich footer. */
export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrolled(16);
  const { isDark, toggleTheme } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();
  // Anchor links need to be absolute when the visitor is not on the landing page.
  const isLanding = pathname === '/';

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? 'border-b border-surface-border bg-canvas/85 backdrop-blur-xl' : 'border-b border-transparent'
        }`}
      >
        <nav className="cc-section flex h-16 items-center justify-between gap-4" aria-label="Main">
          <Logo size={36} />

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                {link.to === '/sitemap' ? (
                  <Link
                    to="/sitemap"
                    className="rounded-xl px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-brand-500/8 hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={isLanding ? link.to.replace('/', '') : link.to}
                    className="rounded-xl px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-brand-500/8 hover:text-ink"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="cc-btn-icon-sm grid place-items-center rounded-xl border border-surface-border bg-surface text-ink-muted transition hover:text-ink"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAuthenticated ? (
              <Link to="/dashboard" className="cc-btn-primary cc-btn-sm sm:px-4 sm:py-2 sm:text-sm">
                {user?.name?.split(' ')[0]}’s dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden text-sm font-semibold text-ink-muted transition-colors hover:text-ink sm:block sm:px-3">
                  Login
                </Link>
                <Link to="/register" className="cc-btn-primary cc-btn-sm sm:px-4 sm:py-2 sm:text-sm">
                  Get Started
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="cc-btn-icon-sm grid place-items-center rounded-xl border border-surface-border bg-surface text-ink-muted lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 0.9, 0.32, 1] }}
              className="overflow-hidden border-t border-surface-border bg-canvas/95 backdrop-blur-xl lg:hidden"
            >
              <ul className="cc-section flex flex-col gap-1 py-4">
                {NAV_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={isLanding ? link.to.replace('/', '') : link.to}
                      className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-brand-500/8 hover:text-ink"
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                {!isAuthenticated && (
                  <li className="mt-2 flex gap-2">
                    <Link to="/login" className="cc-btn-secondary flex-1" onClick={() => setMenuOpen(false)}>
                      Login
                    </Link>
                    <Link to="/register" className="cc-btn-primary flex-1" onClick={() => setMenuOpen(false)}>
                      Get Started
                    </Link>
                  </li>
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-surface-border bg-surface/60">
      <div className="cc-section py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo size={40} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              A student-first budgeting platform built for hostel life, canteen food and irregular income — not for salaried adults
              with bank integrations.
            </p>
            <div className="mt-5 flex gap-2">
              {[
                { icon: Twitter, label: 'Twitter' },
                { icon: Github, label: 'GitHub' },
                { icon: Linkedin, label: 'LinkedIn' },
                { icon: Mail, label: 'Email' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  title={`${label} — demo link`}
                  className="grid h-9 w-9 cursor-default place-items-center rounded-xl border border-surface-border bg-surface text-ink-muted"
                  aria-label={`${label} (demo placeholder)`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Benefits', href: '#benefits' },
              { label: 'FAQ', href: '#faq' },
            ]}
          />
          <FooterColumn
            title="App"
            links={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Transactions', to: '/transactions' },
              { label: 'Budgets', to: '/budgets' },
              { label: 'Reports', to: '/reports' },
            ]}
          />
          <FooterColumn
            title="Account"
            links={[
              { label: 'Login', to: '/login' },
              { label: 'Create account', to: '/register' },
              { label: 'Forgot password', to: '/forgot-password' },
              { label: 'Admin portal', to: '/admin/login' },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-surface-border pt-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Campus Coin · Smart Spending, Student Style. Built as an end-to-end MERN project.</p>
          <p className="flex items-center gap-3">
            <span className="cc-badge-neutral">NextGen BudgetBee</span>
            <Link to="/sitemap" className="cc-link">Sitemap</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <h3 className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.to ? (
              <NavLink to={link.to} className="text-sm text-ink-muted transition-colors hover:text-brand-500">
                {link.label}
              </NavLink>
            ) : (
              <a href={link.href} className="text-sm text-ink-muted transition-colors hover:text-brand-500">
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
