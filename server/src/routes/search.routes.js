const express = require('express');
const { query } = require('express-validator');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const SavingTip = require('../models/SavingTip');
const Insight = require('../models/Insight');
const Bookmark = require('../models/Bookmark');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const escapeRegex = (value) => String(value).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/search?q=
 * Global search across transactions, categories, tips, insights and bookmarks —
 * powers the ⌘K palette in the dashboard header.
 */
router.get(
  '/',
  validate([query('q').trim().isLength({ min: 2, max: 60 }).withMessage('Type at least two characters')]),
  asyncHandler(async (req, res) => {
    const regex = new RegExp(escapeRegex(req.query.q), 'i');
    const userId = req.user._id;

    const [transactions, categories, tips, insights, bookmarks] = await Promise.all([
      Transaction.find({ user: userId, $or: [{ description: regex }, { notes: regex }] })
        .populate('category', 'name color icon')
        .sort({ date: -1 })
        .limit(6)
        .lean(),
      Category.find({ user: userId, name: regex }).limit(5).lean(),
      SavingTip.find({ user: userId, dismissed: false, $or: [{ title: regex }, { body: regex }] }).limit(5).lean(),
      Insight.find({ user: userId, $or: [{ title: regex }, { summaryText: regex }] }).limit(4).lean(),
      Bookmark.find({ user: userId, $or: [{ title: regex }, { body: regex }] }).limit(5).lean(),
    ]);

    const results = [
      ...transactions.map((t) => ({
        kind: 'transaction',
        id: t._id,
        title: t.description || `${t.type} transaction`,
        subtitle: `${t.type === 'income' ? '+' : '−'}${t.amount} · ${t.category?.name || 'Uncategorised'} · ${new Date(t.date).toLocaleDateString('en-GB')}`,
        href: `/transactions?search=${encodeURIComponent(t.description || '')}`,
        color: t.category?.color,
        icon: t.category?.icon,
      })),
      ...categories.map((c) => ({ kind: 'category', id: c._id, title: c.name, subtitle: `${c.type} category`, href: '/categories', color: c.color, icon: c.icon })),
      ...tips.map((t) => ({ kind: 'tip', id: t._id, title: t.title, subtitle: 'Saving tip', href: '/insights', color: '#22C55E', icon: 'Lightbulb' })),
      ...insights.map((i) => ({ kind: 'insight', id: i._id, title: i.title, subtitle: 'Monthly insight', href: '/insights', color: '#6D5DFB', icon: 'Sparkles' })),
      ...bookmarks.map((b) => ({ kind: 'bookmark', id: b._id, title: b.title, subtitle: `Saved ${b.itemType}`, href: '/bookmarks', color: '#F59E0B', icon: 'Bookmark' })),
    ];

    return ok(res, { query: req.query.q, count: results.length, results }, results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No matches found');
  }),
);

module.exports = router;
