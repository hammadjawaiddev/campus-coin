import axios from 'axios';

/**
 * Single axios instance for the whole app.
 * - Relative baseURL (`/api`) so the Vite dev server proxy handles the backend
 *   in development and the same origin serves it in production.
 * - The JWT is attached from localStorage; the server also accepts it via an
 *   httpOnly cookie.
 */
const TOKEN_KEY = 'campus-coin-token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 25000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Normalise every failure into `{ message, status, details, code }`. */
const normaliseError = (error) => {
  const status = error.response?.status || 0;
  const payload = error.response?.data || {};

  let message = payload.message;
  if (!message) {
    if (error.code === 'ECONNABORTED') message = 'The request took too long. Please check your connection and try again.';
    else if (status === 0) message = 'Cannot reach the Campus Coin API. Make sure the server is running.';
    else if (status >= 500) message = 'The server hit an unexpected problem. Please try again.';
    else message = 'Something went wrong. Please try again.';
  }

  return {
    message,
    status,
    details: payload.details || null,
    code: payload.details?.code || null,
    isNetworkError: status === 0,
  };
};

/** Set by AuthContext so a 401 can bounce the user to the login screen once. */
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalised = normaliseError(error);
    const isAuthEndpoint = /\/auth\/(login|register|forgot-password|reset-password)/.test(error.config?.url || '');
    if (normalised.status === 401 && !isAuthEndpoint && onUnauthorized) {
      onUnauthorized(normalised);
    }
    return Promise.reject(normalised);
  },
);

/** Thin helpers that return `data` directly and throw a readable error object. */
const unwrap = (promise) => promise.then((response) => response.data);

export const http = {
  get: (url, config) => unwrap(api.get(url, config)),
  post: (url, body, config) => unwrap(api.post(url, body, config)),
  put: (url, body, config) => unwrap(api.put(url, body, config)),
  patch: (url, body, config) => unwrap(api.patch(url, body, config)),
  delete: (url, config) => unwrap(api.delete(url, config)),
  /**
   * Authenticated binary download (CSV exports, template files).
   * Fetched with the Authorization header and saved through a temporary blob
   * URL, so protected files never leak a token into the address bar.
   */
  download: async (url, { params, filename } = {}) => {
    const response = await api.get(url, { params, responseType: 'blob' });
    const disposition = response.headers['content-disposition'] || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const name = filename || match?.[1] || 'campus-coin-export.csv';

    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);

    return { filename: name, bytes: response.data.size };
  },
  /** Fetch a protected file as a Blob (used to feed the sample CSV back into upload). */
  blob: async (url, config) => {
    const response = await api.get(url, { ...config, responseType: 'blob' });
    return response.data;
  },
  /** Multipart upload (CSV import). */
  upload: (url, formData, onProgress) =>
    unwrap(
      api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        },
      }),
    ),
};

export default api;
