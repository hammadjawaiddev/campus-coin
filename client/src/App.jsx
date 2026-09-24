import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import PublicLayout from './layouts/PublicLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';

import ProtectedRoute from './components/ProtectedRoute.jsx';
import { LogoMark } from './components/ui/Brand.jsx';

/* ── Route-level code splitting keeps the first paint fast ─────────────── */
const Landing = lazy(() => import('./pages/Landing.jsx'));
const Sitemap = lazy(() => import('./pages/Sitemap.jsx'));
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));
const Onboarding = lazy(() => import('./pages/auth/Onboarding.jsx'));

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Transactions = lazy(() => import('./pages/Transactions.jsx'));
const TransactionForm = lazy(() => import('./pages/TransactionForm.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const Budgets = lazy(() => import('./pages/Budgets.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const ImportCsv = lazy(() => import('./pages/ImportCsv.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Bookmarks = lazy(() => import('./pages/Bookmarks.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories.jsx'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics.jsx'));

const NotFound = lazy(() => import('./pages/errors/NotFound.jsx'));
const Unauthorized = lazy(() => import('./pages/errors/Unauthorized.jsx'));
const ServerError = lazy(() => import('./pages/errors/ServerError.jsx'));

/** Branded suspense fallback — matches the boot splash, no white flashes. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4">
      <LogoMark size={46} animated />
      <p className="text-sm text-ink-muted">Loading Campus Coin…</p>
    </div>
  );
}

/** Fades between routes without delaying interaction. */
function PageTransition({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 0.9, 0.32, 1] }}>
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* ── Public marketing ─────────────────────────────────────── */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
            <Route path="/sitemap" element={<PageTransition><Sitemap /></PageTransition>} />
          </Route>

          {/* ── Authentication ───────────────────────────────────────── */}
          <Route
            path="/login"
            element={
              <AuthLayout title="Welcome back" subtitle="Sign in to pick up where your budget left off.">
                <PageTransition><Login /></PageTransition>
              </AuthLayout>
            }
          />
          <Route
            path="/register"
            element={
              <AuthLayout
                title="Create your Campus Coin account"
                subtitle="Free for students. Takes about 30 seconds — no bank details required."
              >
                <PageTransition><Register /></PageTransition>
              </AuthLayout>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <AuthLayout title="Forgot your password?" subtitle="Enter your email and we will send a secure reset link.">
                <PageTransition><ForgotPassword /></PageTransition>
              </AuthLayout>
            }
          />
          <Route
            path="/reset-password"
            element={
              <AuthLayout title="Choose a new password" subtitle="Pick something at least 8 characters long with a number in it.">
                <PageTransition><ResetPassword /></PageTransition>
              </AuthLayout>
            }
          />

          {/* ── Onboarding (authenticated, outside the app shell) ─────── */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <PageTransition><Onboarding /></PageTransition>
              </ProtectedRoute>
            }
          />

          {/* ── Student app ──────────────────────────────────────────── */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
            <Route path="/transactions" element={<PageTransition><Transactions /></PageTransition>} />
            <Route path="/add-transaction" element={<PageTransition><TransactionForm mode="create" /></PageTransition>} />
            <Route path="/edit-transaction/:id" element={<PageTransition><TransactionForm mode="edit" /></PageTransition>} />
            <Route path="/categories" element={<PageTransition><Categories /></PageTransition>} />
            <Route path="/budgets" element={<PageTransition><Budgets /></PageTransition>} />
            <Route path="/goals" element={<PageTransition><Goals /></PageTransition>} />
            <Route path="/reports" element={<PageTransition><Reports /></PageTransition>} />
            <Route path="/import" element={<PageTransition><ImportCsv /></PageTransition>} />
            <Route path="/insights" element={<PageTransition><Insights /></PageTransition>} />
            <Route path="/bookmarks" element={<PageTransition><Bookmarks /></PageTransition>} />
            <Route path="/notifications" element={<PageTransition><Notifications /></PageTransition>} />
            <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
          </Route>

          {/* ── Admin area (separate shell, role protected) ───────────── */}
          {/* The admin sign-in is a self-contained screen (its own dark shell),
              so it deliberately sits outside the shared student auth layout. */}
          <Route path="/admin/login" element={<PageTransition><AdminLogin /></PageTransition>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<PageTransition><AdminDashboard /></PageTransition>} />
            <Route path="users" element={<PageTransition><AdminUsers /></PageTransition>} />
            <Route path="categories" element={<PageTransition><AdminCategories /></PageTransition>} />
            <Route path="announcements" element={<PageTransition><AdminAnnouncements /></PageTransition>} />
            <Route path="analytics" element={<PageTransition><AdminAnalytics /></PageTransition>} />
          </Route>

          {/* ── Error pages ──────────────────────────────────────────── */}
          <Route path="/unauthorized" element={<PageTransition><Unauthorized /></PageTransition>} />
          <Route path="/server-error" element={<PageTransition><ServerError /></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
