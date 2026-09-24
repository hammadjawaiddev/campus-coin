const notificationService = require('../services/notificationService');
const bookmarkService = require('../services/bookmarkService');
const { ok, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** GET /api/notifications */
const list = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    notificationService.list(req.user._id, {
      limit: Math.min(100, Number(req.query.limit) || 40),
      unreadOnly: req.query.unreadOnly === 'true',
      type: req.query.type || null,
    }),
    notificationService.unreadCount(req.user._id),
  ]);

  const grouped = items.reduce((acc, n) => {
    const bucket = n.type.startsWith('budget') ? 'Budgets' : n.type.includes('savings') || n.type === 'goal' ? 'Goals' : n.type === 'insight' ? 'Insights' : 'Other';
    acc[bucket] = acc[bucket] || [];
    acc[bucket].push(n);
    return acc;
  }, {});

  return ok(res, { notifications: items, unread, grouped }, 'Notifications loaded');
});

/** GET /api/notifications/unread-count — polled for the header badge. */
const unreadCount = asyncHandler(async (req, res) => ok(res, { unread: await notificationService.unreadCount(req.user._id) }, 'Unread count'));

/** PATCH /api/notifications/:id/read */
const markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.user._id, req.params.id);
  return ok(res, { unread: await notificationService.unreadCount(req.user._id) }, 'Marked as read');
});

/** POST /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user._id);
  return ok(res, { unread: 0 }, 'All notifications marked as read');
});

/** DELETE /api/notifications/:id */
const dismiss = asyncHandler(async (req, res) => {
  const notification = await notificationService.dismiss(req.user._id, req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found');
  return ok(res, { id: req.params.id }, 'Notification dismissed');
});

/** DELETE /api/notifications/read */
const clearRead = asyncHandler(async (req, res) => {
  await notificationService.clearRead(req.user._id);
  return ok(res, null, 'Read notifications cleared');
});

/** POST /api/notifications/test — verifies the pipeline end-to-end (dev helper). */
const sendTest = asyncHandler(async (req, res) => {
  const notification = await notificationService.notify({
    user: req.user._id,
    type: 'announcement',
    title: 'Test notification',
    message: 'Notifications are working — budget alerts, milestones and insights will appear here.',
    severity: 'success',
    link: '/notifications',
    dedupeKey: `test:${req.user._id}:${Date.now()}`,
  });
  return created(res, { notification }, 'Test notification created');
});

/** GET /api/bookmarks */
const listBookmarks = asyncHandler(async (req, res) => {
  const { itemType } = req.query;
  const bookmarks = await bookmarkService.list(req.user._id, { itemType });
  return ok(res, { bookmarks, counts: await bookmarkService.counts(req.user._id) }, 'Bookmarks loaded');
});

/** POST /api/bookmarks */
const createBookmark = asyncHandler(async (req, res) => {
  const bookmark = await bookmarkService.create(req.user._id, req.body);
  return created(res, { bookmark }, 'Saved to bookmarks');
});

/** DELETE /api/bookmarks/:id */
const removeBookmark = asyncHandler(async (req, res) => {
  const removed = await bookmarkService.remove(req.user._id, req.params.id);
  if (!removed) throw ApiError.notFound('Bookmark not found');
  return ok(res, { id: req.params.id }, 'Bookmark removed');
});

module.exports = { list, unreadCount, markRead, markAllRead, dismiss, clearRead, sendTest, listBookmarks, createBookmark, removeBookmark };
