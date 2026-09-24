import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Bell, Bookmark, ChevronDown, FileText, Home, LayoutDashboard, LogOut, Menu, Moon, PiggyBank,
  Plus, Search, Settings, ShieldCheck, Sparkles, Sun, Tags, Target, TrendingUp, Upload, Wallet, X,
} from 'lucide-react';
import Logo from '../components/ui/Brand';
import Button from '../components/ui/Button';
import { Avatar, Badge } from '../components/ui/Primitives';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { notificationApi } from '../services/endpoints';
import { formatMoney, formatRelative } from '../utils/format';
import { useApi, useDebounced } from '../hooks/useApi';
import { searchApi } from '../services/endpoints';
import CategoryIcon from '../components/ui/CategoryIcon';

const PRIMARY_NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Wallet },
  { to: '/budgets', label: 'Budgets', icon: BarChart3, badge: 'alerts' },
  { to: '/goals', label: 'Savings Goals', icon: Target },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/insights', label: 'Insights & Tips', icon: Sparkles },
];

const SECONDARY_NAV = [
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/import', label: 'Import CSV', icon: Upload },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'unread' },
  { to: '/profile', label: 'Profile', icon: Home },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_NAV = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'History', icon: Wallet },
  { to: '/add-transaction', label: 'Add', icon: Plus, primary: true },
  { to: '/budgets', label: 'Budgets', icon: BarChart3 },
  { to: '/insights', label: 'Insights', icon: Sparkles },
];

export default function DashboardLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 320);

  const { data: notificationState, refresh: refreshNotifications } = useApi(() => notificationApi.list({ limit: 5 }), {
    deps: [],
    initialData: { notifications: [], unread: 0 },
  });

  // Close overlays on navigation.
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
    setPaletteOpen(false);
  }, [location.pathname]);

  // ⌘K / Ctrl+K opens the search palette.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Refresh the notification badge when a transaction or alert changes elsewhere.
  useEffect(() => {
    const handler = () => refreshNotifications();
    window.addEventListener('cc:notifications-changed', handler);
    return () => window.removeEventListener('cc:notifications-changed', handler);
  }, [refreshNotifications]);

  const unread = notificationState?.unread || 0;
  const badgeFor = useCallback((badge) => (badge === 'unread' ? unread : null), [unread]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-canvas">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[264px] border-r border-surface-border bg-surface transition-transform duration-300 ease-smooth lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo size={34} to="/dashboard" />
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-soft hover:bg-ink-soft/10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex h-[calc(100dvh-8rem)] flex-col gap-6 overflow-y-auto px-3 pb-6">
          <NavSection title="Track" links={PRIMARY_NAV} badgeFor={badgeFor} unread={unread} />
          <NavSection title="Organise" links={SECONDARY_NAV} badgeFor={badgeFor} unread={unread} />

          {isAdmin && (
            <div>
              <p className="mb-2 px-3 text-2xs font-semibold uppercase tracking-wider text-ink-soft">Admin</p>
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-3 rounded-xl border border-brand-500/25 bg-brand-500/8 px-3 py-2.5 text-sm font-medium text-brand-600 transition hover:bg-brand-500/14 dark:text-brand-300"
              >
                <ShieldCheck className="h-4 w-4" />
                Admin control panel
              </Link>
            </div>
          )}

          <div className="mt-auto space-y-3 px-2">
            <div className="rounded-2xl border border-surface-border bg-surface-muted p-3.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-500" aria-hidden="true" />
                <p className="text-xs font-semibold text-ink">Demo tip</p>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-muted">
                Open any widget to see the numbers behind it — every figure comes from your own logged transactions.
              </p>
            </div>
            <Button variant="secondary" size="sm" className="w-full" icon={LogOut} onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </nav>
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Main column ───────────────────────────────────────────────── */}
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-surface-border bg-canvas/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="cc-btn-icon-sm grid place-items-center rounded-xl border border-surface-border bg-surface text-ink-muted lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-surface-border bg-surface-muted px-3 py-2 text-sm text-ink-soft transition hover:border-brand-400/50 sm:max-w-sm"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Search transactions, tips…</span>
              <span className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border border-surface-border bg-surface px-1.5 py-0.5 text-2xs font-medium sm:flex">
                ⌘K
              </span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <Link to="/add-transaction" className="cc-btn-primary cc-btn-sm hidden sm:inline-flex">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                className="cc-btn-icon-sm grid place-items-center rounded-xl border border-surface-border bg-surface text-ink-muted transition hover:text-ink"
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <Link
                to="/notifications"
                className="cc-btn-icon-sm relative grid place-items-center rounded-xl border border-surface-border bg-surface text-ink-muted transition hover:text-ink"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-2 py-1.5 transition hover:border-brand-400/50"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <Avatar name={user?.name} color={user?.avatar?.color} size="xs" url={user?.avatar?.url} />
                  <span className="hidden text-sm font-medium text-ink sm:block">{user?.name?.split(' ')[0]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      role="menu"
                      className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-lift"
                    >
                      <div className="border-b border-surface-border px-4 py-3">
                        <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                        <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {user?.academicYear && <Badge tone="info">{user.academicYear}</Badge>}
                          {isAdmin && <Badge tone="warning">Admin</Badge>}
                        </div>
                      </div>
                      <div className="p-1.5">
                        <MenuItem to="/profile" icon={Home} label="Profile" />
                        <MenuItem to="/settings" icon={Settings} label="Settings & preferences" />
                        <MenuItem to="/bookmarks" icon={Bookmark} label="Bookmarks" />
                        {isAdmin && <MenuItem to="/admin/dashboard" icon={ShieldCheck} label="Admin panel" />}
                      </div>
                      <div className="border-t border-surface-border p-1.5">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10"
                          role="menuitem"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom navigation ──────────────────────────────────── */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface/95 backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <ul className="flex items-stretch justify-around px-1 py-1.5">
          {MOBILE_NAV.map(({ to, label, icon: Icon, primary }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-brand-500' : 'text-ink-soft'
                  }`
                }
              >
                <span className={primary ? 'grid h-9 w-9 place-items-center rounded-2xl bg-brand-gradient text-white shadow-[0_8px_20px_-8px_rgba(109,93,251,.9)]' : ''}>
                  <Icon className={primary ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden="true" />
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} query={search} setQuery={setSearch} debouncedQuery={debouncedSearch} />
    </div>
  );
}

function NavSection({ title, links, badgeFor, unread }) {
  return (
    <div>
      <p className="mb-2 px-3 text-2xs font-semibold uppercase tracking-wider text-ink-soft">{title}</p>
      <ul className="space-y-0.5">
        {links.map(({ to, label, icon: Icon, badge }) => {
          const count = badgeFor(badge);
          const show = badge === 'unread' ? unread > 0 : Boolean(count);
          return (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-500/12 text-brand-600 dark:text-brand-300'
                      : 'text-ink-muted hover:bg-brand-500/8 hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-500' : ''}`} aria-hidden="true" />
                    <span className="truncate">{label}</span>
                    {show && (
                      <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-rose-500/90 px-1 text-[10px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MenuItem({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      role="menuitem"
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-brand-500/8 hover:text-ink"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** ⌘K search across transactions, categories, tips and insights. */
function CommandPalette({ open, onClose, query, setQuery, debouncedQuery }) {
  const navigate = useNavigate();
  const { data, isLoading } = useApi(() => searchApi.query(debouncedQuery), {
    deps: [debouncedQuery],
    enabled: open && debouncedQuery.trim().length >= 2,
    initialData: { results: [], count: 0 },
  });

  const grouped = useMemo(() => {
    const map = new Map();
    (data?.results || []).forEach((result) => {
      map.set(result.kind, [...(map.get(result.kind) || []), result]);
    });
    return [...map.entries()];
  }, [data]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 0.9, 0.32, 1] }}
            role="dialog"
            aria-label="Search Campus Coin"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-lift"
          >
            <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
              <Search className="h-4 w-4 text-ink-soft" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search transactions, categories, tips, insights…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
                aria-label="Search"
              />
              <kbd className="rounded-md border border-surface-border bg-surface-muted px-1.5 py-0.5 text-2xs text-ink-soft">ESC</kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {debouncedQuery.trim().length < 2 && (
                <p className="px-3 py-6 text-center text-xs text-ink-soft">Type at least two characters to search your data.</p>
              )}
              {debouncedQuery.trim().length >= 2 && isLoading && <p className="px-3 py-6 text-center text-xs text-ink-soft">Searching…</p>}
              {debouncedQuery.trim().length >= 2 && !isLoading && !grouped.length && (
                <p className="px-3 py-6 text-center text-xs text-ink-soft">Nothing matched “{debouncedQuery}”.</p>
              )}
              {grouped.map(([kind, results]) => (
                <div key={kind} className="mb-1.5">
                  <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-soft">{kind}</p>
                  {results.map((result) => (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      onClick={() => {
                        navigate(result.href);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-brand-500/8"
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{ backgroundColor: `${result.color || '#6D5DFB'}1F`, color: result.color || '#6D5DFB' }}
                      >
                        {result.icon ? <CategoryIcon name={result.icon} className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{result.title}</span>
                        <span className="block truncate text-xs text-ink-muted">{result.subtitle}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { formatMoney, formatRelative };
