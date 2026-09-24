import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ExternalLink, Lock, ShieldCheck } from 'lucide-react';

/**
 * Visual sitemap (an explicit SRS requirement: "add a sitemap to the home page").
 * Rendered as an interactive tree of cards rather than plain text, with the
 * authenticated and admin-only branches clearly marked.
 */

const PUBLIC_BRANCH = {
  label: 'Home',
  href: '/',
  description: 'Landing page with features, flow, FAQ and this sitemap',
  children: [
    { label: 'Features', href: '/#features', description: 'What the platform does' },
    { label: 'How it works', href: '/#how-it-works', description: 'Four-step interactive walkthrough' },
    { label: 'Benefits', href: '/#benefits', description: 'Why it fits student life' },
    { label: 'FAQ', href: '/#faq', description: 'Common questions answered' },
  ],
};

const AUTH_BRANCH = {
  label: 'Account',
  description: 'Authentication and profile flows',
  children: [
    { label: 'Login', to: '/login' },
    { label: 'Register', to: '/register' },
    { label: 'Forgot password', to: '/forgot-password' },
    { label: 'Reset password', to: '/reset-password', locked: true, note: 'Tokenised link from email' },
    { label: 'Onboarding', to: '/onboarding', locked: true, note: '5 steps, skippable' },
    { label: 'Profile', to: '/profile', locked: true },
  ],
};

const DASHBOARD_BRANCH = {
  label: 'Dashboard',
  to: '/dashboard',
  locked: true,
  description: 'Personalised overview: balance, charts, alerts, tips',
  children: [
    { label: 'Overview', to: '/dashboard', locked: true, note: 'Summary, widgets, quick add' },
    { label: 'Transactions', to: '/transactions', locked: true, note: 'Search, filter, sort, paginate' },
    { label: 'Add / Edit transaction', to: '/add-transaction', locked: true, note: 'AI categorisation + duplicate check' },
    { label: 'Budgets', to: '/budgets', locked: true, note: 'Per-category monthly caps and alerts' },
    { label: 'Savings Goals', to: '/goals', locked: true, note: 'Targets, milestones, contributions' },
    { label: 'Reports', to: '/reports', locked: true, note: 'PDF & CSV export' },
    { label: 'Insights', to: '/insights', locked: true, note: 'Monthly narrative + ranked tips' },
    { label: 'Categories', to: '/categories', locked: true, note: 'Custom icons, colours, reassign on delete' },
    { label: 'Import CSV', to: '/import', locked: true, note: 'Validate, preview, categorise, commit' },
    { label: 'Bookmarks', to: '/bookmarks', locked: true, note: 'Saved tips, insights, report snapshots' },
    { label: 'Notifications', to: '/notifications', locked: true, note: 'Budget alerts and milestones' },
    { label: 'Settings', to: '/settings', locked: true, note: 'Theme, currency, font size, security' },
  ],
};

const ADMIN_BRANCH = {
  label: 'Admin',
  to: '/admin/login',
  locked: true,
  adminOnly: true,
  description: 'Separate protected control panel (role-based access)',
  children: [
    { label: 'Admin login', to: '/admin/login', adminOnly: true },
    { label: 'Dashboard', to: '/admin/dashboard', locked: true, adminOnly: true, note: 'Users, volume, top categories' },
    { label: 'Users', to: '/admin/users', locked: true, adminOnly: true, note: 'Search, view, disable, reset password' },
    { label: 'Categories', to: '/admin/categories', locked: true, adminOnly: true, note: 'Default templates for all students' },
    { label: 'Announcements', to: '/admin/announcements', locked: true, adminOnly: true, note: 'Create, publish, broadcast' },
    { label: 'Analytics', to: '/admin/analytics', locked: true, adminOnly: true, note: 'Growth, volume, popularity' },
  ],
};

export default function SitemapTree({ embedded = false }) {
  return (
    <div className={embedded ? '' : 'cc-card p-5 sm:p-8'}>
      {!embedded && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">Campus Coin site map</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              <Lock className="mr-1 inline h-3 w-3" /> marks pages that require a signed-in session;{' '}
              <ShieldCheck className="mr-1 inline h-3 w-3" /> marks administrator-only areas.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="cc-badge-neutral">22 routes</span>
            <span className="cc-badge-info">3 branches</span>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <BranchCard branch={PUBLIC_BRANCH} index={0} tone="brand" />
        <div className="space-y-5">
          <BranchCard branch={AUTH_BRANCH} index={1} tone="accent" compact />
          <BranchCard branch={DASHBOARD_BRANCH} index={2} tone="mint" />
        </div>
        <BranchCard branch={ADMIN_BRANCH} index={3} tone="amber" />
      </div>
    </div>
  );
}

function BranchCard({ branch, index, tone, compact = false }) {
  const tones = {
    brand: 'from-brand-500/12 text-brand-500 border-brand-500/25',
    accent: 'from-accent-400/12 text-accent-500 border-accent-400/25',
    mint: 'from-mint-500/12 text-mint-600 border-mint-500/25',
    amber: 'from-amber-500/12 text-amber-500 border-amber-500/25',
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="flex h-full flex-col rounded-2xl border border-surface-border bg-surface p-5"
    >
      <div className={`mb-3.5 inline-flex items-center gap-2 self-start rounded-xl border bg-gradient-to-br to-transparent px-3 py-1.5 ${tones}`}>
        {branch.adminOnly ? <ShieldCheck className="h-3.5 w-3.5" /> : branch.locked ? <Lock className="h-3.5 w-3.5" /> : null}
        <span className="text-xs font-bold uppercase tracking-wide">{branch.label}</span>
      </div>

      {branch.description && <p className="mb-3 text-xs leading-relaxed text-ink-muted">{branch.description}</p>}

      <ul className={`space-y-1.5 ${compact ? '' : 'flex-1'}`}>
        {branch.children.map((child) => {
          const content = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-soft/60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-ink group-hover:text-brand-500">{child.label}</span>
                {child.locked && <Lock className="h-3 w-3 shrink-0 text-ink-soft/70" aria-label="Requires sign-in" />}
                {child.adminOnly && <ShieldCheck className="h-3 w-3 shrink-0 text-amber-500" aria-label="Administrator only" />}
              </span>
              <span className="ml-5 flex items-center justify-between gap-3">
                {child.note ? <span className="truncate text-2xs text-ink-soft">{child.note}</span> : <span />}
                <ExternalLink className="h-3 w-3 shrink-0 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </span>
            </>
          );

          const linkProps = {
            className:
              'group flex flex-col gap-0.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-brand-500/[.06] focus-visible:bg-brand-500/[.06]',
          };

          return (
            <li key={`${branch.label}-${child.label}`}>
              {child.to ? (
                <Link to={child.to} {...linkProps}>
                  {content}
                </Link>
              ) : (
                <a href={child.href} {...linkProps} onClick={(event) => {
                  if (child.href.startsWith('/#') && window.location.pathname !== '/') {
                    event.preventDefault();
                    window.location.href = child.href;
                  }
                }}>
                  {content}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
