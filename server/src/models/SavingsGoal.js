const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema(
  {
    percent: { type: Number, required: true },
    reachedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const savingsGoalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Goal name is required'], trim: true, maxlength: 80 },
    targetAmount: { type: Number, required: true, min: [1, 'Target amount must be at least 1'] },
    currentAmount: { type: Number, default: 0, min: 0 },
    targetDate: { type: Date, default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    color: { type: String, default: '#22C55E' },
    icon: { type: String, default: 'Target' },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active', index: true },
    isPrimary: { type: Boolean, default: false },
    milestones: { type: [milestoneSchema], default: [] },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

savingsGoalSchema.index({ user: 1, status: 1, createdAt: -1 });

savingsGoalSchema.virtual('progressPercent').get(function progressPercent() {
  if (!this.targetAmount) return 0;
  return Math.min(100, Math.round((this.currentAmount / this.targetAmount) * 100));
});

savingsGoalSchema.virtual('remainingAmount').get(function remainingAmount() {
  return Math.max(0, Math.round((this.targetAmount - this.currentAmount) * 100) / 100);
});

/** Estimated months left based on a given monthly contribution rate. */
savingsGoalSchema.methods.monthsRemaining = function monthsRemaining(monthlyRate) {
  const remaining = Math.max(0, this.targetAmount - this.currentAmount);
  if (remaining === 0) return 0;
  if (!monthlyRate || monthlyRate <= 0) return null;
  return Math.ceil(remaining / monthlyRate);
};

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
