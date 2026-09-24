const Category = require('../models/Category');
const CategorizationFeedback = require('../models/CategorizationFeedback');
const aiService = require('./aiService');
const env = require('../config/env');
const { round2 } = require('../utils/number');

/**
 * Expense categorisation assistant.
 *
 * Resolution order (best → cheapest):
 *   1. Learned  — the student's own previous correction for the same description/token
 *   2. Rules    — weighted keyword matching against the student's categories
 *   3. AI       — optional OpenAI-compatible call, only if configured and 1 & 2 are unsure
 *
 * Suggestions are ALWAYS advisory: the API stores both the suggested and the
 * user-confirmed category and the UI lets the student override in one tap.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'from', 'at', 'in', 'on', 'my', 'me', 'i',
  'bought', 'buy', 'paid', 'pay', 'payment', 'purchase', 'got', 'get', 'with', 'was', 'is',
  'usd', 'rs', 'rupees', 'dollars', 'today', 'yesterday', 'monthly', 'fee', 'bill',
]);

const normalise = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const tokenize = (text) => normalise(text).split(' ').filter((t) => t.length > 2 && !STOP_WORDS.has(t));

/** Deterministic similarity so identical corrections always win. */
const similarity = (a, b) => {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach((t) => { if (tb.has(t)) shared += 1; });
  return shared / Math.max(ta.size, tb.size);
};

/** 1. Learned from the student's own history. */
async function fromHistory(userId, description, type) {
  const tokens = tokenize(description);
  if (!tokens.length) return null;

  const exact = await CategorizationFeedback.findOne({ user: userId, description: normalise(description) })
    .sort({ createdAt: -1 })
    .populate('confirmedCategory', 'name color icon type');
  if (exact?.confirmedCategory && exact.confirmedCategory.type === type) {
    return {
      categoryId: exact.confirmedCategory._id,
      categoryName: exact.confirmedCategory.name,
      color: exact.confirmedCategory.color,
      icon: exact.confirmedCategory.icon,
      confidence: 0.95,
      source: 'history',
      reason: 'You categorised a similar entry the same way before',
    };
  }

  const matches = await CategorizationFeedback.find({ user: userId, tokens: { $in: tokens } })
    .sort({ createdAt: -1 })
    .limit(25)
    .populate('confirmedCategory', 'name color icon type');

  const best = matches
    .filter((m) => m.confirmedCategory && m.confirmedCategory.type === type)
    .map((m) => ({ m, score: similarity(description, m.description) }))
    .sort((a, b) => b.score - a.score)[0];

  if (best && best.score >= 0.5) {
    return {
      categoryId: best.m.confirmedCategory._id,
      categoryName: best.m.confirmedCategory.name,
      color: best.m.confirmedCategory.color,
      icon: best.m.confirmedCategory.icon,
      confidence: round2(Math.min(0.9, 0.6 + best.score * 0.3)),
      source: 'history',
      reason: `Matches "${best.m.description}" which you filed under ${best.m.confirmedCategory.name}`,
    };
  }
  return null;
}

/** 2. Deterministic keyword rules (works with zero configuration). */
async function fromRules(description, type) {
  if (!description) return null;
  const text = ` ${normalise(description)} `;
  const categories = await Category.find({ user: null, isTemplate: true, type, isArchived: false }).lean();

  let best = null;
  categories.forEach((category) => {
    (category.keywords || []).forEach((keyword) => {
      const k = normalise(keyword);
      if (!k) return;
      // Word-boundary match so "bus" does not match "business".
      const hit = text.includes(` ${k} `) || text.includes(` ${k}s `);
      if (!hit) return;
      // Longer keywords are more specific → higher weight.
      const score = Math.min(1, 0.45 + k.length / 24);
      if (!best || score > best.score) best = { score, category, keyword };
    });
  });

  if (!best) return null;
  return {
    categoryId: best.category._id,
    categoryName: best.category.name,
    color: best.category.color,
    icon: best.category.icon,
    confidence: round2(Math.min(0.92, best.score)),
    source: 'rules',
    reason: `Matched keyword "${best.keyword}"`,
  };
}

/**
 * Main entry point.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.description
 * @param {'income'|'expense'} params.type
 * @param {number} [params.amount]
 * @param {string} [params.currency]
 * @param {boolean} [params.allowAi]  set false for bulk CSV previews unless explicitly requested
 */
async function suggest({ userId, description, type = 'expense', amount = 0, currency = '$', allowAi = true }) {
  const cleaned = String(description || '').trim();
  if (!cleaned) {
    return { suggested: null, alternatives: [], source: 'none', reason: 'Add a short description to get a suggestion', aiUsed: false };
  }

  const learned = await fromHistory(userId, cleaned, type);
  const rule = learned || (await fromRules(cleaned, type));

  const categories = await Category.find({ user: userId, type, isArchived: false }).lean();
  const personalPool = categories.length ? categories : await Category.find({ user: null, isTemplate: true, type }).lean();

  let suggestion = rule;
  let aiUsed = false;
  let aiFailureReason = null;

  // 3. AI only when the local engines are unsure, to keep latency + cost low.
  if (allowAi && env.isAiConfigured && (!suggestion || suggestion.confidence < 0.6)) {
    const ai = await aiService.suggestCategory({ description: cleaned, amount, type, categories: personalPool, currency });
    if (ai.ok) {
      aiUsed = true;
      suggestion = {
        categoryId: ai.categoryId,
        categoryName: ai.categoryName,
        color: personalPool.find((c) => String(c._id) === String(ai.categoryId))?.color || '#6D5DFB',
        icon: personalPool.find((c) => String(c._id) === String(ai.categoryId))?.icon || 'Sparkles',
        confidence: round2(ai.confidence),
        source: 'ai',
        reason: ai.reason || 'Suggested by the AI assistant',
      };
    } else {
      aiFailureReason = ai.reason;
    }
  }

  // Alternatives = best rule match + the student's most used categories.
  const usage = await CategorizationFeedback.aggregate([
    { $match: { user: new (require('mongoose').Types.ObjectId)(String(userId)) } },
    { $group: { _id: '$confirmedCategory', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);
  const usageIds = usage.map((u) => String(u._id));
  const alternatives = personalPool
    .filter((c) => String(c._id) !== String(suggestion?.categoryId))
    .sort((a, b) => {
      const ai = usageIds.indexOf(String(a._id));
      const bi = usageIds.indexOf(String(b._id));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .slice(0, 5)
    .map((c) => ({ categoryId: c._id, categoryName: c.name, color: c.color, icon: c.icon, type: c.type }));

  return {
    suggested: suggestion,
    alternatives,
    source: suggestion?.source || 'none',
    reason: suggestion?.reason || 'Add a short description to get a suggestion',
    aiUsed,
    aiConfigured: env.isAiConfigured,
    aiFailureReason,
  };
}

/** Batch suggestions for the CSV importer. */
async function suggestBatch({ userId, rows, type = 'expense', currency = '$', useAi = true }) {
  const out = new Map();
  const needsAi = [];

  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const resolved = await suggest({ userId, description: row.description, type, amount: row.amount, currency, allowAi: false });
    if (resolved.suggested && resolved.suggested.confidence >= 0.6) {
      out.set(String(row.id), { ...resolved.suggested, alternatives: resolved.alternatives });
    } else {
      needsAi.push(row);
      out.set(String(row.id), { ...(resolved.suggested || {}), alternatives: resolved.alternatives, lowConfidence: true });
    }
  }

  let aiUsed = false;
  if (useAi && env.isAiConfigured && needsAi.length) {
    const categories = await Category.find({ user: userId, isArchived: false }).lean();
    const ai = await aiService.suggestCategoryBatch({
      rows: needsAi.map((r) => ({ id: r.id, description: r.description, type, amount: r.amount })),
      categories,
      currency,
    });
    if (ai.ok) {
      aiUsed = true;
      needsAi.forEach((row) => {
        const hit = ai.results.get(String(row.id));
        if (!hit) return;
        const previous = out.get(String(row.id)) || {};
        out.set(String(row.id), {
          ...previous,
          categoryId: hit.categoryId,
          categoryName: hit.categoryName,
          confidence: round2(hit.confidence),
          source: 'ai',
          reason: 'Suggested by the AI assistant',
          lowConfidence: hit.confidence < 0.6,
        });
      });
    }
  }

  return { suggestions: out, aiUsed, aiConfigured: env.isAiConfigured };
}

/** Persist what the student actually confirmed — this is the learning signal. */
async function recordFeedback({ userId, description, suggestedCategoryId, confirmedCategoryId, source = 'rules', confidence = null }) {
  const accepted = suggestedCategoryId && String(suggestedCategoryId) === String(confirmedCategoryId);
  await CategorizationFeedback.create({
    user: userId,
    description: normalise(description).slice(0, 200),
    tokens: tokenize(description),
    suggestedCategory: suggestedCategoryId || null,
    confirmedCategory: confirmedCategoryId,
    source: accepted ? source : 'manual',
    accepted,
    confidence,
  });
}

/** Accuracy metrics for the admin dashboard. */
async function accuracyStats({ since = null } = {}) {
  const match = since ? { createdAt: { $gte: since } } : {};
  const rows = await CategorizationFeedback.aggregate([
    { $match: match },
    { $group: { _id: '$source', count: { $sum: 1 }, accepted: { $sum: { $cond: ['$accepted', 1, 0] } } } },
  ]);
  const totals = rows.reduce((acc, r) => ({ count: acc.count + r.count, accepted: acc.accepted + r.accepted }), { count: 0, accepted: 0 });
  return {
    total: totals.count,
    accepted: totals.accepted,
    accuracy: totals.count ? round2((totals.accepted / totals.count) * 100) : 0,
    bySource: rows.map((r) => ({ source: r._id, count: r.count, accepted: r.accepted })),
  };
}

module.exports = { suggest, suggestBatch, recordFeedback, accuracyStats, tokenize, similarity: similarity };
