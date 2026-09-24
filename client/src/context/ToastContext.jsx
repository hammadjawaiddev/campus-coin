import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: CheckCircle2, accent: 'text-mint-500', bar: 'bg-mint-500' },
  error: { icon: XCircle, accent: 'text-rose-500', bar: 'bg-rose-500' },
  warning: { icon: AlertTriangle, accent: 'text-amber-500', bar: 'bg-amber-500' },
  info: { icon: Info, accent: 'text-brand-500', bar: 'bg-brand-500' },
};

/**
 * Lightweight toast system (no dependency) with stacked, auto-dismissing
 * notifications. Used for every async action so no button is ever silent.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = toast.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry = {
        id,
        variant: 'info',
        duration: 4200,
        ...toast,
      };
      setToasts((prev) => [...prev.slice(-3), entry]);
      if (entry.duration > 0) setTimeout(() => dismiss(id), entry.duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push({ ...options, variant: 'success', message }),
      error: (message, options) => push({ ...options, variant: 'error', message, duration: options?.duration ?? 6000 }),
      warning: (message, options) => push({ ...options, variant: 'warning', message }),
      info: (message, options) => push({ ...options, variant: 'info', message }),
      dismiss,
      /** Turns an API error object into a toast, with field details appended. */
      fromError: (error, fallback = 'Something went wrong') => {
        const detail = error?.details?.[0]?.message;
        push({
          variant: 'error',
          message: error?.message || fallback,
          description: detail && detail !== error?.message ? detail : error?.details?.hint,
          duration: 6500,
        });
      },
    }),
    [push, dismiss],
  );

  // Allow non-React modules (e.g. the axios interceptor) to raise toasts.
  useEffect(() => {
    const handler = (event) => {
      api.error(event.detail?.message || 'Your session expired. Please sign in again.');
    };
    window.addEventListener('cc:session-expired', handler);
    return () => window.removeEventListener('cc:session-expired', handler);
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:left-auto sm:right-5 sm:top-5 sm:items-end sm:px-0"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const variant = VARIANTS[toast.variant] || VARIANTS.info;
            const Icon = variant.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 0.9, 0.32, 1] }}
                className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-surface-border bg-surface-raised/95 p-3.5 pr-9 shadow-lift backdrop-blur-xl"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${variant.bar}`} aria-hidden="true" />
                <div className="flex gap-3">
                  <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${variant.accent}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{toast.message}</p>
                    {toast.description && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{toast.description}</p>}
                    {toast.action && (
                      <button type="button" onClick={toast.action.onClick} className="cc-link mt-1.5 text-xs">
                        {toast.action.label}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="absolute right-2 top-2.5 rounded-lg p-1 text-ink-soft transition hover:bg-ink-soft/10 hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
};
