const mongoose = require('mongoose');

/**
 * A category belongs either to a single student (`user` set) or to the global
 * template set managed by admins (`user: null`, `isTemplate: true`). New
 * students receive a personal copy of every active template at registration so
 * they can freely rename / recolour / delete without affecting others.
 */
const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: [true, 'Category name is required'], trim: true, maxlength: 40 },
    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    icon: { type: String, default: 'Package' },
    color: { type: String, default: '#6D5DFB' },
    isTemplate: { type: Boolean, default: false, index: true },
    isDefault: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    keywords: { type: [String], default: [] },
    monthlyBudgetHint: { type: Number, min: 0, default: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// A student cannot have two categories with the same name + type.
categorySchema.index({ user: 1, name: 1, type: 1 }, { unique: true });
categorySchema.index({ user: 1, type: 1, order: 1 });

categorySchema.statics.buildKeywordIndex = function buildKeywordIndex(categories) {
  // Lower-cased "keyword -> category id" lookup used by the rule engine.
  const index = new Map();
  categories.forEach((category) => {
    (category.keywords || []).forEach((keyword) => {
      index.set(String(keyword).toLowerCase(), category);
    });
  });
  return index;
};

module.exports = mongoose.model('Category', categorySchema);
