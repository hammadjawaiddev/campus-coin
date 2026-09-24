import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing, Check, Database, Eye, Info, Languages, Mail, Monitor, MoonStar, Palette, RefreshCw, RotateCcw,
  Save, Server, ShieldCheck, Sparkles, Sun, Trash2, Type, Wallet, Zap,
} from 'lucide-react';

import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Badge, Segmented, Toggle } from '../components/ui/Primitives.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { useApi, useApiAction } from '../hooks/useApi.js';
import { metaApi, notificationApi, userApi } from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { CURRENCY_SYMBOLS, formatMoney } from '../utils/format.js';

const CURRENCY_LABELS = {
  USD: 'US Dollar',
  PKR: 'Pakistani Rupee',
  INR: 'Indian Rupee',
  EUR: 'Euro',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  BDT: 'Bangladeshi Taka',
};

export default function Settings() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const theme = useTheme();

  const { data: health, refresh: refreshHealth, isRefreshing: healthRefreshing } = useApi(() => metaApi.health(), { deps: [] });
  const { data: config } = useApi(() => metaApi.config(), { deps: [] });

  const [preferences, setPreferences] = useState({
    currency: 'USD',
    theme: 'system',
    fontSize: 'base',
    reducedMotion: false,
    emailAlerts: true,
    weeklyDigest: false,
  });
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!user?.preferences) return;
    setPreferences((prev) => ({ ...prev, ...user.preferences }));
  }, [user]);

  // Mirror the live contexts so the UI always shows what is actually applied.
  useEffect(() => {
    setPreferences((prev) => ({ ...prev, theme: theme.theme, fontSize: theme.fontSize, reducedMotion: theme.reducedMotion }));
  }, [theme.theme, theme.fontSize, theme.reducedMotion]);

  const saveAction = useApiAction((payload) => userApi.updatePreferences(payload), {
    onSuccess: () => {
      toast.success('Preferences saved', { description: 'They are applied everywhere immediately.' });
      refresh();
    },
    onError: (err) => toast.fromError(err, 'Could not save your preferences'),
  });

  const testNotification = useApiAction(() => notificationApi.sendTest(), {
    onSuccess: () => {
      toast.success('Test notification created', { description: 'Check the bell icon in the header.' });
      window.dispatchEvent(new CustomEvent('cc:notifications-changed'));
    },
    onError: (err) => toast.fromError(err, 'Could not create a test notification'),
  });

  /** Persist currency + email preferences to the profile. */
  const save = (patch) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    saveAction.run({
      currency: next.currency,
      emailAlerts: next.emailAlerts,
      weeklyDigest: next.weeklyDigest,
    });
  };

  /** Theme, font size and motion live in ThemeContext, which persists locally
   *  for an instant boot and syncs to the profile in the background. */
  const applyAppearance = (patch) => {
    if (patch.theme !== undefined) theme.setTheme(patch.theme);
    if (patch.fontSize !== undefined) theme.setFontSize(patch.fontSize);
    if (patch.reducedMotion !== undefined) theme.setReducedMotion(patch.reducedMotion);
    setPreferences((prev) => ({ ...prev, ...patch }));
  };

  const resetLocalUi = () => {
    applyAppearance({ theme: 'system', fontSize: 'base', reducedMotion: false });
    setConfirmReset(false);
    toast.success('Interface preferences reset');
  };

  const services = health?.services || {};
  const aiStatus = services.ai || {};

  return (
    <>
      <PageHeader
        title="Settings"
        description="Appearance, currency, accessibility and the integrations this deployment has configured."
        crumbs={[{ label: 'Settings' }]}
        icon={Palette}
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          {/* ── Appearance ─────────────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader title="Appearance" subtitle="Dark mode is persisted on this device and applied before first paint" icon={Palette} />

            <div>
              <span className="cc-label">Theme</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: MoonStar },
                  { value: 'system', label: 'System', icon: Monitor },
                ].map((option) => {
                  const active = preferences.theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applyAppearance({ theme: option.value })}
                      aria-pressed={active}
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition ${
                        active ? 'border-brand-500 bg-brand-500/10 text-ink' : 'border-surface-border text-ink-muted hover:border-brand-400/40'
                      }`}
                    >
                      <option.icon className="h-4 w-4" />
                      {option.label}
                      {active && <Check className="ml-auto h-4 w-4 text-brand-500" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-2xs text-ink-soft">
                “System” follows your device setting and switches automatically at dusk.
              </p>
            </div>

            <div className="mt-5">
              <span className="cc-label">Font size</span>
              <Segmented
                ariaLabel="Font size"
                value={preferences.fontSize}
                onChange={(value) => applyAppearance({ fontSize: value })}
                options={[
                  { value: 'sm', label: 'Compact' },
                  { value: 'base', label: 'Default' },
                  { value: 'lg', label: 'Large' },
                ]}
              />
              <p className="mt-2 text-2xs text-ink-soft">
                <Type className="mr-1 inline h-3 w-3" />
                Large text increases the base size across dashboards and tables — useful on small laptop screens or for
                accessibility.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-surface-border bg-surface-muted p-4">
              <Toggle
                id="reduced-motion"
                checked={preferences.reducedMotion}
                onChange={(value) => applyAppearance({ reducedMotion: value })}
                label="Reduce motion"
                description="Disables page transitions, chart animations and hover lifts."
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
                Reset interface preferences
              </Button>
              <span className="text-2xs text-ink-soft">
                Stored under <code className="rounded bg-ink-soft/12 px-1">campus-coin-ui</code> in this browser.
              </span>
            </div>
          </Card>

          {/* ── Money ──────────────────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader title="Currency & money" subtitle="Used everywhere money is shown" icon={Wallet} />
            <label className="block max-w-sm">
              <span className="cc-label">Display currency</span>
              <select
                value={preferences.currency}
                onChange={(event) => save({ currency: event.target.value })}
                className="cc-select"
              >
                {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                  <option key={code} value={code}>
                    {CURRENCY_LABELS[code] || code} ({symbol})
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-2xs leading-relaxed text-ink-soft">
              Amounts are stored exactly as you enter them and rendered with this symbol — Campus Coin never converts or invents
              exchange rates. Example: {formatMoney(1234.5, CURRENCY_SYMBOLS[preferences.currency] || '$')}
            </p>
          </Card>

          {/* ── Notifications ──────────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader title="Notifications" subtitle="What Campus Coin tells you about" icon={BellRing} />
            <div className="space-y-3">
              <div className="rounded-2xl border border-surface-border bg-surface-muted p-4">
                <Toggle
                  id="email-alerts"
                  checked={preferences.emailAlerts}
                  onChange={(value) => save({ emailAlerts: value })}
                  label="Email me budget alerts"
                  description="Sent only when a budget passes its alert threshold. Requires SMTP to be configured."
                />
              </div>
              <div className="rounded-2xl border border-surface-border bg-surface-muted p-4">
                <Toggle
                  id="weekly-digest"
                  checked={preferences.weeklyDigest}
                  onChange={(value) => save({ weeklyDigest: value })}
                  label="Weekly summary email"
                  description="A short digest of spending, budget status and top tips every Sunday."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" icon={BellRing} loading={testNotification.isRunning} onClick={() => testNotification.run()}>
                Create a test notification
              </Button>
              <Link to="/notifications" className="cc-btn-ghost cc-btn-sm">Open notifications</Link>
            </div>
            {services.email && (
              <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-ink-soft">
                <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                {services.email.configured
                  ? `Email is configured (${services.email.host || 'SMTP'}) and digests will be delivered.`
                  : 'Email is not configured in this deployment — email actions are recorded in the server log instead of being sent.'}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* ── Deployment / services ─────────────────────────────── */}
          <Card className="p-5">
            <CardHeader
              title="Deployment"
              subtitle="Live status from the API"
              icon={Server}
              action={<Button variant="ghost" size="sm" icon={RefreshCw} loading={healthRefreshing} onClick={() => refreshHealth()}>Refresh</Button>}
            />
            {!health ? (
              <p className="text-xs text-ink-soft">Checking the API…</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                <Row label="API status">
                  <Badge tone={health.status === 'healthy' ? 'success' : 'warning'}>{health.status}</Badge>
                </Row>
                <Row label="Environment">
                  <span className="font-medium capitalize text-ink">{health.environment}</span>
                </Row>
                <Row label="Version">
                  <span className="font-medium text-ink">v{health.version}</span>
                </Row>
                <Row label="Database">
                  <span className="font-medium text-ink">
                    {health.database.state} {health.database.name ? `· ${health.database.name}` : ''}
                  </span>
                </Row>
                <Row label="Uptime">
                  <span className="font-medium text-ink">{Math.floor((health.uptimeSeconds || 0) / 60)} min</span>
                </Row>
                <Row label="AI assistant">
                  <Badge tone={aiStatus.configured ? 'success' : 'neutral'}>
                    {aiStatus.configured ? `connected${aiStatus.model ? ` · ${aiStatus.model}` : ''}` : 'rule-based fallback'}
                  </Badge>
                </Row>
                <Row label="Email">
                  <Badge tone={services.email?.configured ? 'success' : 'neutral'}>
                    {services.email?.configured ? 'configured' : 'not configured'}
                  </Badge>
                </Row>
              </ul>
            )}

            {!aiStatus.configured && (
              <p className="mt-3.5 flex items-start gap-2 rounded-xl border border-brand-500/25 bg-brand-500/[.06] p-3 text-2xs leading-relaxed text-ink-muted">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" />
                No AI key is set on this server, so categorisation uses your own history plus keyword rules, and monthly insights are
                written by the analytics engine. Add <code className="rounded bg-ink-soft/12 px-1">AI_API_KEY</code> to{' '}
                <code className="rounded bg-ink-soft/12 px-1">server/.env</code> to switch on the language model — nothing else changes.
              </p>
            )}
          </Card>

          {/* ── Feature flags ─────────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader title="Enabled features" subtitle="Reported by the API" icon={Zap} />
            <ul className="grid grid-cols-2 gap-2.5">
              {Object.entries(config?.features || {}).map(([key, value]) => (
                <li key={key} className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface-muted px-3 py-2.5 text-xs">
                  <span className="capitalize text-ink-muted">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                  <Badge tone={value ? 'success' : 'neutral'}>{value ? 'on' : 'off'}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          {/* ── Data & privacy ───────────────────────────────────── */}
          <Card className="p-5">
            <CardHeader title="Data & privacy" subtitle="How your information is handled" icon={ShieldCheck} />
            <ul className="space-y-3 text-xs leading-relaxed text-ink-muted">
              <li className="flex items-start gap-2">
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                Transactions, budgets, goals and insights live in your own MongoDB documents, scoped to your user id on every query.
              </li>
              <li className="flex items-start gap-2">
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                Passwords are hashed with bcrypt; reset tokens are single-use and expire. Sessions use signed JWTs.
              </li>
              <li className="flex items-start gap-2">
                <Languages className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                AI features are optional: when enabled, only the short description you type is sent to the model — never your balance or
                account details.
              </li>
              <li className="flex items-start gap-2">
                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                You can deactivate your account from the profile page. An administrator can restore it within the retention window.
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <CardHeader title="About Campus Coin" subtitle={config?.brand?.theme} icon={Info} />
            <p className="text-xs leading-relaxed text-ink-muted">
              <strong className="text-ink">{config?.brand?.name}</strong> — {config?.brand?.tagline}. Built as a full-stack MERN
              application: React + Vite + Tailwind on the client, Node + Express + MongoDB on the server, with JWT authentication and
              role-based administration.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/sitemap" className="cc-btn-secondary cc-btn-sm">View sitemap</Link>
              <Link to="/insights" className="cc-btn-ghost cc-btn-sm">How insights work</Link>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetLocalUi}
        tone="primary"
        title="Reset interface preferences?"
        message="Theme, font size and motion settings will return to their defaults on this device. Your account data is not affected."
        confirmLabel="Reset appearance"
      />
    </>
  );
}

function Row({ label, children }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      {children}
    </li>
  );
}
