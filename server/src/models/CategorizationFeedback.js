const mongoose = require('mongoose');

/**
 * Records how the student responded to a suggested category.
 * Two purposes:
 *  1. Powers "learned" suggestions — past corrections for the same description
 *     keyword are re-used before anything else.
 *  2. Gives the admin panel measurable accuracy of the intelligence layer.
 */
const categorizationFeedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    description: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    tokens: { type: [String], default: [] },
    suggestedCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    confirmedCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    source: { type: String, enum: ['ai', 'rules', 'history', 'manual'], default: 'rules' },
    accepted: { type: Boolean, default: false },
    confidence: { type: Number, default: null },
  },
  { timestamps: true },
);

categorizationFeedbackSchema.index({ user: 1, description: 1 });
categorizationFeedbackSchema.index({ user: 1, tokens: 1 });

module.exports = mongoose.model('CategorizationFeedback', categorizationFeedbackSchema);
