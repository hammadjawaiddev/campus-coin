import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small data-fetching hook: handles loading/error/refresh and ignores responses
 * from stale requests. Enough for this app without pulling in a query library.
 *
 * @param {(signal?: AbortSignal) => Promise<any>} fetcher
 * @param {{deps?: any[], enabled?: boolean, initialData?: any, onError?: Function}} options
 */
export function useApi(fetcher, { deps = [], enabled = true, initialData = null, onError } = {}) {
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current();
        if (id === requestId.current) {
          setData(result?.data ?? result);
          setMeta(result?.meta ?? null);
          return result;
        }
        return null;
      } catch (err) {
        if (id !== requestId.current) return null;
        setError(err);
        onError?.(err);
        return null;
      } finally {
        if (id === requestId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [onError],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setLocal = useCallback((updater) => {
    setData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  return {
    data,
    /** Envelope `meta` (pagination, filters echoed back by the API). */
    meta,
    error,
    isLoading,
    isRefreshing,
    refresh: () => run({ silent: true }),
    reload: () => run({ silent: false }),
    setData: setLocal,
  };
}

/** Imperative action wrapper: `const { run, isRunning } = useApiAction(...)`. */
export function useApiAction(action, { onSuccess, onError, successMessage } = {}) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (...args) => {
      setIsRunning(true);
      setError(null);
      try {
        const result = await action(...args);
        onSuccess?.(result, ...args);
        return result;
      } catch (err) {
        setError(err);
        onError?.(err);
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [action, onSuccess, onError],
  );

  return { run, isRunning, error, successMessage };
}

/** Debounced value — powers the search inputs without hammering the API. */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Media query hook for responsive behaviour in JS (charts, nav, etc.). */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Tracks whether the user is currently scrolled past a threshold. */
export function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}
