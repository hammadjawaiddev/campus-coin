const ActivityLog = require('../models/ActivityLog');
const { logger } = require('../utils/logger');

/**
 * Fire-and-forget activity logging. Powers "recently viewed / recently edited"
 * and admin usage analytics. Never throws into the request path.
 */
const logActivity = async ({ user, action, entity = 'system', entityId = null, label = '', meta = {} }) => {
  try {
    await ActivityLog.create({ user, action, entity, entityId, label, meta });
  } catch (error) {
    logger.debug('activity log failed:', error.message);
  }
};

const recentActivity = (user, { limit = 10, actions = null } = {}) => {
  const query = { user };
  if (actions) query.action = { $in: actions };
  return ActivityLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};

const recentlyViewedTransactions = (user, limit = 5) =>
  ActivityLog.find({ user, entity: 'transaction', action: 'view' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'entityId', select: 'amount type description date category', populate: { path: 'category', select: 'name color icon type' } })
    .lean();

const recentlyEditedTransactions = (user, limit = 5) =>
  ActivityLog.find({ user, entity: 'transaction', action: { $in: ['create', 'update'] } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'entityId', select: 'amount type description date category', populate: { path: 'category', select: 'name color icon type' } })
    .lean();

module.exports = { logActivity, recentActivity, recentlyViewedTransactions, recentlyEditedTransactions };
