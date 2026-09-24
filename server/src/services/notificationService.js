const Notification = require('../models/Notification');
const { NOTIFICATION_TYPES } = require('../config/constants');
const { logger } = require('../utils/logger');

/**
 * Creates a notification once per `dedupeKey` (unique sparse index enforces the
 * guarantee even under concurrent requests). Failures never break the main flow.
 */
const notify = async ({ user, type, title, message, severity = 'info', link = '', meta = {}, dedupeKey = null }) => {
  try {
    const doc = await Notification.create({
      user, type, title, message, severity, link, meta, dedupeKey,
    });
    return doc;
  } catch (error) {
    if (error.code === 11000) return null; // already notified
    logger.debug('notification failed:', error.message);
    return null;
  }
};

const list = (user, { limit = 30, unreadOnly = false, type = null } = {}) => {
  const query = { user, dismissed: false };
  if (unreadOnly) query.read = false;
  if (type) query.type = type;
  return Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};

const unreadCount = (user) => Notification.countDocuments({ user, read: false, dismissed: false });

const markRead = (user, id = null) => {
  const query = { user, read: false };
  if (id) query._id = id;
  return Notification.updateMany(query, { $set: { read: true, readAt: new Date() } });
};

const markAllRead = (user) => markRead(user, null);

const dismiss = (user, id) => Notification.findOneAndUpdate({ user, _id: id }, { $set: { dismissed: true } }, { new: true });

const clearRead = (user) => Notification.deleteMany({ user, read: true });

const NOTIFICATION_TEMPLATES = {
  welcome: (name) => ({
    type: NOTIFICATION_TYPES.WELCOME,
    title: `Welcome to Campus Coin, ${name.split(' ')[0]}! 🎉`,
    message: 'Log your first expense to unlock personalised insights, saving tips and budget alerts.',
    severity: 'success',
    link: '/add-transaction',
  }),
  budgetNear: (categoryName, percent, remaining, currency) => ({
    type: NOTIFICATION_TYPES.BUDGET_NEAR,
    title: `${categoryName} budget at ${percent}%`,
    message: `You have ${currency}${remaining.toFixed(2)} left in your ${categoryName} budget this month.`,
    severity: 'warning',
    link: '/budgets',
  }),
  budgetExceeded: (categoryName, over, currency) => ({
    type: NOTIFICATION_TYPES.BUDGET_EXCEEDED,
    title: `${categoryName} budget exceeded`,
    message: `You are ${currency}${over.toFixed(2)} over your ${categoryName} budget. Review the category to get back on track.`,
    severity: 'danger',
    link: '/budgets',
  }),
  savingsMilestone: (goalName, percent, amount, currency) => ({
    type: NOTIFICATION_TYPES.SAVINGS_MILESTONE,
    title: `${percent}% of "${goalName}" saved! 🏆`,
    message: `You have now saved ${currency}${amount.toFixed(2)} towards ${goalName}. Keep the momentum going.`,
    severity: 'success',
    link: '/goals',
  }),
  goalCompleted: (goalName) => ({
    type: NOTIFICATION_TYPES.GOAL,
    title: `Goal complete: ${goalName} 🎯`,
    message: 'You reached your savings target. Time to set the next one?',
    severity: 'success',
    link: '/goals',
  }),
  insight: (title) => ({
    type: NOTIFICATION_TYPES.INSIGHT,
    title: 'Your new monthly insight is ready',
    message: title || 'A fresh plain-language summary of your month is available.',
    severity: 'info',
    link: '/insights',
  }),
  import: (imported, skipped) => ({
    type: NOTIFICATION_TYPES.IMPORT,
    title: 'CSV import completed',
    message: `${imported} transaction${imported === 1 ? '' : 's'} imported${skipped ? `, ${skipped} skipped` : ''}.`,
    severity: 'success',
    link: '/transactions',
  }),
  largeTransaction: (label, amount, currency, multiple) => ({
    type: NOTIFICATION_TYPES.LARGE_TRANSACTION,
    title: 'Unusually large transaction detected',
    message: `${label} of ${currency}${amount.toFixed(2)} is about ${multiple}x your usual spend in this category.`,
    severity: 'warning',
    link: '/transactions',
  }),
  duplicateTransaction: (label, amount, currency) => ({
    type: NOTIFICATION_TYPES.DUPLICATE_TRANSACTION,
    title: 'Possible duplicate transaction',
    message: `A similar ${label} of ${currency}${amount.toFixed(2)} was logged recently. Check it to avoid double counting.`,
    severity: 'warning',
    link: '/transactions',
  }),
  announcement: (title, body) => ({
    type: NOTIFICATION_TYPES.ANNOUNCEMENT,
    title,
    message: body,
    severity: 'info',
    link: '/dashboard',
  }),
};

module.exports = {
  notify,
  list,
  unreadCount,
  markRead,
  markAllRead,
  dismiss,
  clearRead,
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_TYPES,
};
