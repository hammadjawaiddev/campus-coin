const Bookmark = require('../models/Bookmark');
const SavingTip = require('../models/SavingTip');
const Insight = require('../models/Insight');
const ApiError = require('../utils/ApiError');

/**
 * Bookmarks for tips, insights and saved report summaries.
 * The service mirrors the flag back onto the source document so the tip /
 * insight card can render its saved state without a second lookup.
 */

const list = (userId, { itemType = null, limit = 100 } = {}) => {
  const query = { user: userId };
  if (itemType) query.itemType = itemType;
  return Bookmark.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};

const counts = async (userId) => {
  const rows = await Bookmark.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$itemType', count: { $sum: 1 } } },
  ]);
  const map = { tip: 0, insight: 0, report: 0 };
  rows.forEach((r) => { map[r._id] = r.count; });
  return { ...map, total: Object.values(map).reduce((a, b) => a + b, 0) };
};

/**
 * Create a bookmark. Either references an existing tip/insight, or stores a
 * standalone summary (used by reports).
 */
async function create(userId, { itemType, itemId = null, title, body = '', meta = {} }) {
  let resolvedTitle = title;
  let resolvedBody = body;
  let resolvedMeta = meta;

  if (itemId && itemType === 'tip') {
    const tip = await SavingTip.findOne({ _id: itemId, user: userId });
    if (!tip) throw ApiError.notFound('Tip not found');
    resolvedTitle = resolvedTitle || tip.title;
    resolvedBody = resolvedBody || tip.body;
    resolvedMeta = { severity: tip.severity, potentialSaving: tip.potentialSaving, categoryName: tip.categoryName, ...meta };
    tip.bookmarked = true;
    await tip.save();
  } else if (itemId && itemType === 'insight') {
    const insight = await Insight.findOne({ _id: itemId, user: userId });
    if (!insight) throw ApiError.notFound('Insight not found');
    resolvedTitle = resolvedTitle || insight.title;
    resolvedBody = resolvedBody || insight.summaryText;
    resolvedMeta = { month: insight.month, source: insight.source, ...meta };
    insight.bookmarked = true;
    await insight.save();
  } else if (!resolvedTitle) {
    throw ApiError.badRequest('A bookmark needs a title');
  }

  const bookmark = await Bookmark.findOneAndUpdate(
    { user: userId, itemType, itemId: itemId || new require('mongoose').Types.ObjectId() },
    { $set: { title: resolvedTitle, body: resolvedBody, meta: resolvedMeta }, $setOnInsert: { user: userId, itemType } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return bookmark;
}

async function remove(userId, id) {
  const bookmark = await Bookmark.findOneAndDelete({ _id: id, user: userId });
  if (!bookmark) return null;

  if (bookmark.itemType === 'tip') await SavingTip.updateOne({ _id: bookmark.itemId, user: userId }, { $set: { bookmarked: false } });
  if (bookmark.itemType === 'insight') await Insight.updateOne({ _id: bookmark.itemId, user: userId }, { $set: { bookmarked: false } });
  return bookmark;
}

module.exports = { list, counts, create, remove };
