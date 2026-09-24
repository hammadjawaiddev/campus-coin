const mongoose = require('mongoose');
const { RECURRING_FREQUENCIES } = require('../config/constants');

const RECURRING_ACTIVE = ['active', 'paused', 'ended'];

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
      set: (v) => Math.round(Number(v) * 100) / 100,
    },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    date: { type: Date, required: true, default: Date.now, index: true },

    // Recurring support (monthly allowance, subscriptions, ...)
    recurring: { type: Boolean, default: false },
    recurringFrequency: {
      type: String,
      enum: [...RECURRING_FREQUENCIES, null],
      default: null,
    },
    recurringStatus: { type: String, enum: [...RECURRING_ACTIVE, null], default: null },
    nextOccurrence: { type: Date, default: null },
    parentTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    isGenerated: { type: Boolean, default: false },

    // AI / intelligence metadata ------------------------------------------
    aiSuggestedCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
    aiSource: { type: String, enum: ['ai', 'rules', 'history', null], default: null },
    userConfirmedCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    aiSuggestionAccepted: { type: Boolean, default: null },
    isAnomaly: { type: Boolean, default: false },
    anomalyReason: { type: String, default: '' },
    anomalyScore: { type: Number, default: null },

    // Provenance -----------------------------------------------------------
    source: { type: String, enum: ['manual', 'csv', 'seed', 'recurring'], default: 'manual' },
    importBatch: { type: String, default: null, index: true },
    receiptUrl: { type: String, default: '' },
  },
  { timestamps: true },
);

// Primary access pattern: "my transactions, newest first, filtered".
transactionSchema.index({ user: 1, date: -1, _id: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1, date: -1 });
// Used to detect duplicates fast.
transactionSchema.index({ user: 1, amount: 1, date: 1, type: 1 });
// Recurring scheduler sweep.
transactionSchema.index({ recurring: 1, recurringStatus: 1, nextOccurrence: 1 });

transactionSchema.virtual('signedAmount').get(function signedAmount() {
  return this.type === 'income' ? this.amount : -this.amount;
});

module.exports = mongoose.model('Transaction', transactionSchema);
