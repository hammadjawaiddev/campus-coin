const mongoose = require('mongoose');

/**
 * Lightweight audit trail: powers "recently viewed / recently edited"
 * (SRS optional system intelligence) and admin usage insight.
 */
const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      enum: ['view', 'create', 'update', 'delete', 'login', 'logout', 'import', 'export', 'ai'],
      required: true,
    },
    entity: { type: String, enum: ['transaction', 'budget', 'goal', 'category', 'insight', 'tip', 'report', 'auth', 'system'], default: 'system' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    label: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, entity: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });
// Keep the log self-pruning: entries older than 120 days expire.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 120 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
