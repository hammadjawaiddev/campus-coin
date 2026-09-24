import { http } from './api';

/**
 * Typed-ish API surface. Every screen imports from here so endpoint strings
 * live in exactly one place.
 */

export const authApi = {
  register: (payload) => http.post('/auth/register', payload),
  login: (payload) => http.post('/auth/login', payload),
  logout: () => http.post('/auth/logout'),
  me: () => http.get('/auth/me'),
  forgotPassword: (payload) => http.post('/auth/forgot-password', payload),
  resetPassword: (payload) => http.post('/auth/reset-password', payload),
  verifyResetToken: (token) => http.get(`/auth/reset-password/${token}`),
  changePassword: (payload) => http.put('/auth/password', payload),
  completeOnboarding: (payload) => http.post('/auth/onboarding', payload),
};

export const userApi = {
  me: () => http.get('/users/me'),
  update: (payload) => http.put('/users/me', payload),
  updatePreferences: (payload) => http.put('/users/me/preferences', payload),
  summary: () => http.get('/users/me/summary'),
  activity: () => http.get('/users/me/activity'),
  sendDigest: () => http.post('/users/me/digest'),
  deactivate: (payload) => http.delete('/users/me', { data: payload }),
};

export const transactionApi = {
  list: (params) => http.get('/transactions', { params }),
  meta: () => http.get('/transactions/meta'),
  get: (id) => http.get(`/transactions/${id}`),
  create: (payload) => http.post('/transactions', payload),
  update: (id, payload) => http.put(`/transactions/${id}`, payload),
  remove: (id) => http.delete(`/transactions/${id}`),
  duplicate: (id, payload = {}) => http.post(`/transactions/${id}/duplicate`, payload),
  suggest: (payload) => http.post('/transactions/ai-suggest', payload),
  precheck: (payload) => http.post('/transactions/precheck', payload),
  recentActivity: () => http.get('/transactions/activity/recent'),
  recurring: () => http.get('/transactions/recurring'),
  setRecurringStatus: (id, status) => http.post(`/transactions/recurring/${id}/status`, { status }),
  runRecurring: () => http.post('/transactions/recurring/run'),
  detection: () => http.get('/transactions/detection/insights'),
};

export const categoryApi = {
  list: (params) => http.get('/categories', { params }),
  create: (payload) => http.post('/categories', payload),
  update: (id, payload) => http.put(`/categories/${id}`, payload),
  remove: (id, params) => http.delete(`/categories/${id}`, { params }),
  usage: (id) => http.get(`/categories/${id}/usage`),
  restoreDefaults: () => http.post('/categories/restore-defaults'),
};

export const budgetApi = {
  list: (params) => http.get('/budgets', { params }),
  save: (payload) => http.post('/budgets', payload),
  update: (id, payload) => http.put(`/budgets/${id}`, payload),
  remove: (id) => http.delete(`/budgets/${id}`),
  copyPrevious: (payload) => http.post('/budgets/copy', payload),
  alerts: (params) => http.get('/budgets/alerts', { params }),
  resetAlerts: (payload) => http.post('/budgets/reset-alerts', payload),
  insights: (params) => http.get('/budgets/insights', { params }),
  categoryUsage: (categoryId, params) => http.get(`/budgets/usage/${categoryId}`, { params }),
};

export const goalApi = {
  list: () => http.get('/goals'),
  create: (payload) => http.post('/goals', payload),
  update: (id, payload) => http.put(`/goals/${id}`, payload),
  contribute: (id, amount) => http.post(`/goals/${id}/contribute`, { amount }),
  remove: (id) => http.delete(`/goals/${id}`),
};

export const dashboardApi = {
  get: (params) => http.get('/dashboard', { params }),
  checklist: () => http.get('/dashboard/checklist'),
  forecast: () => http.get('/dashboard/forecast'),
  compare: (params) => http.get('/dashboard/compare', { params }),
};

export const insightApi = {
  list: (params) => http.get('/insights', { params }),
  latest: () => http.get('/insights/latest'),
  generate: (payload) => http.post('/insights/generate', payload),
  setStatus: (id, status) => http.patch(`/insights/${id}`, { status }),
  bookmark: (id) => http.post(`/insights/${id}/bookmark`),
  recommendations: () => http.get('/insights/recommendations'),
  accuracy: () => http.get('/insights/accuracy'),
};

export const tipApi = {
  list: (params) => http.get('/tips', { params }),
  generate: (payload) => http.post('/tips/generate', payload),
  update: (id, action, value) => http.post(`/tips/${id}/${action}`, { value }),
  weeklyCap: (categoryName) => http.get(`/tips/weekly-cap/${encodeURIComponent(categoryName)}`),
};

export const notificationApi = {
  list: (params) => http.get('/notifications', { params }),
  unreadCount: () => http.get('/notifications/unread-count'),
  markRead: (id) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.post('/notifications/read-all'),
  dismiss: (id) => http.delete(`/notifications/${id}`),
  clearRead: () => http.delete('/notifications/read'),
  sendTest: () => http.post('/notifications/test'),
};

export const bookmarkApi = {
  list: (params) => http.get('/bookmarks', { params }),
  create: (payload) => http.post('/bookmarks', payload),
  remove: (id) => http.delete(`/bookmarks/${id}`),
};

export const reportApi = {
  get: (params) => http.get('/reports', { params }),
  save: (payload) => http.post('/reports/save', payload),
  exportCsv: (params) =>
    http.download('/reports/export.csv', {
      params,
      filename: `campus-coin-report-${params?.from || 'range'}-to-${params?.to || 'today'}.csv`,
    }),
};

export const importApi = {
  preview: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.upload('/import/preview', formData, onProgress);
  },
  commit: (payload) => http.post('/import/commit', payload),
  undo: (batchId) => http.post(`/import/undo/${batchId}`),
  history: () => http.get('/import/history'),
  downloadTemplate: () => http.download('/import/template', { filename: 'campus-coin-import-template.csv' }),
  downloadSample: () => http.download('/import/sample', { filename: 'campus-coin-sample-transactions.csv' }),
  sampleBlob: () => http.blob('/import/sample'),
};

export const announcementApi = {
  list: () => http.get('/announcements'),
};

export const searchApi = {
  query: (q) => http.get('/search', { params: { q } }),
};

export const metaApi = {
  config: () => http.get('/config'),
  health: () => http.get('/health'),
};

export const adminApi = {
  dashboard: () => http.get('/admin/dashboard'),
  users: (params) => http.get('/admin/users', { params }),
  user: (id) => http.get(`/admin/users/${id}`),
  setUserStatus: (id, payload) => http.patch(`/admin/users/${id}/status`, payload),
  resetUserPassword: (id, payload) => http.post(`/admin/users/${id}/reset-password`, payload),
  userActivity: (id, params) => http.get(`/admin/users/${id}/activity`, { params }),
  categories: () => http.get('/admin/categories'),
  createCategory: (payload) => http.post('/admin/categories', payload),
  updateCategory: (id, payload) => http.put(`/admin/categories/${id}`, payload),
  deleteCategory: (id) => http.delete(`/admin/categories/${id}`),
  applyCategories: () => http.post('/admin/categories/apply-to-all'),
  announcements: (params) => http.get('/admin/announcements', { params }),
  createAnnouncement: (payload) => http.post('/admin/announcements', payload),
  updateAnnouncement: (id, payload) => http.put(`/admin/announcements/${id}`, payload),
  deleteAnnouncement: (id) => http.delete(`/admin/announcements/${id}`),
  analytics: (params) => http.get('/admin/analytics', { params }),
  transactions: (params) => http.get('/admin/transactions', { params }),
  recomputeInsights: (payload) => http.post('/admin/maintenance/recompute-insights', payload),
};
