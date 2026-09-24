const mongoose = require('mongoose');

/**
 * One budget per user + category + month.
 * `month` is always stored as the first day of the month at 00:00 UTC so that
 * month keys are easy to compare and index.
 */
const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    type: { type: String, enum: ['expense', 'income'], default: 'expense' },
    month: { type: Date, required: true, index: true },
    limitAmount: { type: Number, required: [true, 'Budget limit is required'], min: [1, 'Budget limit must be at least 1'] },
    alertThreshold: { type: Number, min: 10, max: 150, default: 80 }, // % of limit that triggers "near limit"
    notifyNearLimit: { type: Boolean, default: true },
    notifyExceeded: { type: Boolean, default: true },
    rollover: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    // Tracks which alerts already fired for this budget/month to avoid spam.
    alerts: {
      near: { type: Date, default: null },
      exceeded: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

budgetSchema.index({ user: 1, month: 1, category: 1 }, { unique: true });
budgetSchema.index({ user: 1, month: 1, type: 1 });

/** Normalise any date to the first day of its month (UTC). */
budgetSchema.statics.monthKey = function monthKey(date = new Date()) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

budgetSchema.statics.parseMonthParam = function parseMonthParam(value) {
  if (!value) return budgetSchema.statics.monthKey(new Date());
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return budgetSchema.statics.monthKey(value);
  return budgetSchema.statics.monthKey(new Date());
};

module.exports = mongoose.model('Budget', budgetSchema);
