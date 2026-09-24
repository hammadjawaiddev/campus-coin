import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, ChevronLeft, ExternalLink, Layers, LayoutDashboard, LogOut, Megaphone, Menu, MoonStar, ShieldCheck,
  Sun, Tag, Users, X, Zap,
} from 'lucide-react';

import { Logo, LogoMark } from '../components/ui/Brand.jsx';
import Button from '../components/ui/Button.jsx';
import { Avatar, Badge } from '../components/ui/Primitives.jsx';
import { OfflineBanner } from '../components/ui/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { metaApi } from '../services/endpoints.js';

const NAV = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, description: 'Platform totals and recent activity' },
  { to: '/admin/users', label: 'Users', icon: Users, description: 'Search, inspect, disable or reset students' },
  { to: '/admin/categories', label: 'Categories', icon: Tag, description: 'Default template categories for all students' },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, description: 'Broadcast updates to students' },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, description: 'Growth, volume and feature usage' },
];

/**
 * Admin shell — visually distinct from the student dashboard (darker slate rail,
 * amber accents) and completely separate from the student navigation, which is
 * an explicit SRS requirement.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('campus-coin-admin-rail') === 'collapsed');

  const { data: health } = useApi(() => metaApi.health(), { deps: [] });

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('campus-coin-admin-rail', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  const current = useMemo(
    () => NAV.find((item) => location.pathname.startsWith(item.to)) || NAV[0],
    [location.pathname],
  );

  const handleLogout = async () => {
    await logout();
    toast.info('Signed out of the admin panel');
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <OfflineBanner />

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-900 text-slate-100">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 lg:hidden"
            aria-label="Open admin navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="hidden sm:block">
              <span className="block text-sm font-bold leading-tight">Campus Coin</span>
              <span className="block text-2xs font-medium uppercase tracking-wider text-amber-400">Admin panel</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-700 px-2.5 py-1 text-2xs text-slate-300 md:inline-flex">
              <ShieldCheck className="h-3 w-3 text-amber-400" />
              {health?.database?.state === 'connected' ? `DB ${health.database.name || 'connected'}` : 'database offline'}
              {health ? ` · v${health.version}` : ''}
            </span>

            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-300 hover:bg-white/10"
              onClick={theme.toggleTheme}
              aria-label={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme.isDark ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
            </Button>

            <Link
              to="/dashboard"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-2xs text-slate-300 transition hover:bg-white/10 sm:inline-flex"
            >
              <ExternalLink className="h-3 w-3" />
              Student view
            </Link>

            <div className="flex items-center gap-2 rounded-lg border border-slate-700 px-2 py-1.5">
              <Avatar name={user?.name} color={user?.avatar?.color} size="xs" />
              <span className="hidden text-2xs leading-tight sm:block">
                <span className="block font-medium text-slate-100">{user?.name}</span>
                <span className="block text-slate-400">{user?.email}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-rose-300"
                aria-label="Sign out of the admin panel"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-5 sm:px-6">
        {/* ── Rail (desktop) ────────────────────────────────────────── */}
        <aside className={`hidden shrink-0 lg:block ${collapsed ? 'w-[76px]' : 'w-64'}`}>
          <div className="sticky top-[84px]">
            <nav className="rounded-2xl border border-slate-800/60 bg-slate-900 p-2" aria-label="Admin sections">
              <ul className="space-y-1">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          isActive ? 'bg-amber-400 text-slate-900 font-semibold' : 'text-slate-300 hover:bg-white/10'
                        }`
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800/60 bg-slate-900 px-3 py-2 text-2xs text-slate-400 transition hover:bg-white/5"
            >
              <ChevronLeft className={`h-3.5 w-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
              {!collapsed && 'Collapse'}
            </button>

            {!collapsed && (
              <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/[.07] p-3.5">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-amber-500">
                  <Zap className="h-3 w-3" />
                  Maintenance
                </p>
                <p className="mt-1.5 text-2xs leading-relaxed text-slate-300">
                  Insight recomputation and template changes are logged in the activity feed.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* ── Content ───────────────────────────────────────────────── */}
        <main className="min-w-0 flex-1 pb-16">
          <div className="mb-4 flex items-center gap-2 text-2xs text-ink-soft">
            <Layers className="h-3.5 w-3.5" />
            <span>Admin</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-ink-muted">{current.label}</span>
            <span className="ml-auto hidden sm:block">{current.description}</span>
          </div>
          <Outlet />
        </main>
      </div>

      {/* ── Drawer (mobile) ─────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.22, ease: [0.22, 0.9, 0.32, 1] }}
              className="relative z-10 h-full w-72 bg-slate-900 p-4 text-slate-100"
              aria-label="Admin navigation"
            >
              <div className="flex items-center justify-between">
                <Logo size={32} />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="mt-5">
                <ul className="space-y-1">
                  {NAV.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                            isActive ? 'bg-amber-400 font-semibold text-slate-900' : 'text-slate-300 hover:bg-white/10'
                          }`
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-5 rounded-2xl border border-slate-800 p-3.5">
                <p className="text-2xs text-slate-400">Signed in as</p>
                <p className="mt-0.5 text-sm font-medium">{user?.name}</p>
                <Badge tone="warning">administrator</Badge>
                <button type="button" onClick={handleLogout} className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">
                  Sign out
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
