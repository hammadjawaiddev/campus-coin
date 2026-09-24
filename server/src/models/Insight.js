const mongoose = require('mongoose');

/**
 * A monthly, plain-language narrative generated from real transaction data.
 * `source` records whether the text came from the AI provider or the local
 * analytical fallback so the UI can label it honestly.
 */
const insightSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: Date, required: true, index: true }, // first day of month (UTC)
    title: { type: String, default: '' },
    summaryText: { type: String, required: true },
    tipText: { type: String, default: '' },
    highlights: [{ type: String }],
    metrics: {
      totalIncome: { type: Number, default: 0 },
      totalExpense: { type: Number, default: 0 },
      netSavings: { type: Number, default: 0 },
      savingsRate: { type: Number, default: 0 },
      topCategory: { type: String, default: '' },
      biggestChange: { type: String, default: '' },
      transactionCount: { type: Number, default: 0 },
    },
    source: { type: String, enum: ['ai', 'analytics'], default: 'analytics' },
    model: { type: String, default: '' },
    status: { type: String, enum: ['active', 'dismissed'], default: 'active', index: true },
    bookmarked: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

insightSchema.index({ user: 1, month: -1 }, { unique: true });

module.exports = mongoose.model('Insight', insightSchema);
