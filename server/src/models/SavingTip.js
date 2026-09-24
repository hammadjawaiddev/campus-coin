const mongoose = require('mongoose');

/**
 * Tips are produced by the rule based tips engine (see services/tipsEngine.js).
 * The `key` is deterministic for a given month so that re-running the engine
 * updates an existing tip (and keeps the student's pinned/dismissed state)
 * instead of duplicating it.
 */
const savingTipSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true },
    month: { type: Date, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    actionLabel: { type: String, default: '' },
    actionHref: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    categoryName: { type: String, default: '' },
    severity: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
    potentialSaving: { type: Number, default: 0 }, // estimated monthly saving in user's currency
    impactScore: { type: Number, default: 0 }, // ranking score
    pinned: { type: Boolean, default: false },
    bookmarked: { type: Boolean, default: false, index: true },
    dismissed: { type: Boolean, default: false, index: true },
    seenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

savingTipSchema.index({ user: 1, month: 1, key: 1 }, { unique: true });
savingTipSchema.index({ user: 1, dismissed: 1, impactScore: -1 });

module.exports = mongoose.model('SavingTip', savingTipSchema);
