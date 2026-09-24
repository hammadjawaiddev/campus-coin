const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const categorizationService = require('./categorizationService');
const notificationService = require('./notificationService');
const activityService = require('./activityService');
const budgetService = require('./budgetService');
const { round2 } = require('../utils/number');
const { logger } = require('../utils/logger');

/**
 * CSV import pipeline:
 *   upload → parse → validate → preview (with category suggestions) →
 *   user confirms (optionally re-assigning categories) → import → summary
 */

const REQUIRED_COLUMNS = ['date', 'amount'];
const OPTIONAL_COLUMNS = ['description', 'type', 'category', 'notes', 'currency'];

const ALIASES = {
  date: ['date', 'transaction date', 'txn date', 'posted', 'value date'],
  amount: ['amount', 'value', 'debit', 'credit', 'transaction amount'],
  description: ['description', 'details', 'narration', 'memo', 'merchant', 'particulars', 'note'],
  type: ['type', 'transaction type', 'dr/cr', 'direction'],
  category: ['category', 'category name', 'tag'],
  notes: ['notes', 'remarks', 'comment'],
};

const normaliseHeader = (h) =>
  String(h || '')
    .toLowerCase()
    .replace(/^\ufeff/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Maps logical fields to the *header names* found in the file, so reading a row
 * is `record[map.amount]` regardless of column order.
 */
function mapHeaders(headers) {
  const normalised = headers.map(normaliseHeader);
  const map = {};
  Object.entries(ALIASES).forEach(([field, names]) => {
    const idx = normalised.findIndex((h) => names.includes(h));
    if (idx !== -1) map[field] = headers[idx];
  });
  return { map, normalised };
}

const parseAmount = (raw) => {
  if (raw === undefined || raw === null) return NaN;
  const cleaned = String(raw)
    .replace(/[^0-9.,\-()]/g, '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/,(?=\d{3}\b)/g, '');
  const value = Number.parseFloat(cleaned.replace(',', '.'));
  return Number.isFinite(value) ? round2(Math.abs(value)) : NaN;
};

const parseDateValue = (raw) => {
  if (!raw) return null;
  const text = String(raw).trim();
  // Fast paths first, then a tolerant Date parse.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12, 0));

  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(text);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    if (+d > 12 && +m <= 12) return new Date(Date.UTC(+y, +m - 1, +d, 12, 0));
    if (+m > 12 && +d <= 12) return new Date(Date.UTC(+y, +d - 1, +m, 12, 0));
    return new Date(Date.UTC(+y, +m - 1, +d, 12, 0));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0));
};

const detectType = (raw, amountValue) => {
  const text = String(raw || '').toLowerCase().trim();
  if (['income', 'credit', 'cr', 'in', 'deposit', '+'].includes(text)) return 'income';
  if (['expense', 'debit', 'dr', 'out', 'withdrawal', '-'].includes(text)) return 'expense';
  if (typeof raw === 'number' && raw < 0) return 'expense';
  if (String(raw || '').startsWith('-')) return 'expense';
  return amountValue < 0 ? 'expense' : 'expense'; // default: imports are usually expenses
};

/** Parse + validate an uploaded CSV buffer and build the preview payload. */
async function preview({ buffer, user, useAi = true }) {
  if (!buffer || !buffer.length) throw ApiError.badRequest('The uploaded file is empty');

  let records;
  let headers;
  try {
    const text = buffer.toString('utf8').replace(/^\ufeff/, '');
    records = parse(text, {
      columns: (header) => header.map((h) => String(h).trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      max_record_size: 10000,
      to: env.MAX_CSV_ROWS + 1,
    });
    headers = records.length ? Object.keys(records[0]) : [];
  } catch (error) {
    throw ApiError.badRequest(`We could not read that CSV: ${error.message}`);
  }

  if (!records.length) throw ApiError.badRequest('No data rows found in the CSV');

  const { map, normalised } = mapHeaders(headers);
  const missing = REQUIRED_COLUMNS.filter((col) => map[col] === undefined);
  if (missing.length) {
    throw ApiError.badRequest(
      `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Detected columns: ${normalised.join(', ') || 'none'}`,
      { missing, detected: normalised, required: REQUIRED_COLUMNS, optional: OPTIONAL_COLUMNS },
    );
  }

  const userCategories = await Category.find({ user: user._id, isArchived: false }).lean();
  const categoriesByName = new Map(userCategories.map((c) => [c.name.toLowerCase(), c]));
  const userCurrency = user.preferences?.currency || 'USD';
  const symbolMap = { USD: '$', PKR: 'Rs', INR: '₹', EUR: '€', GBP: '£', AED: 'AED', SAR: 'SAR', BDT: '৳' };
  const currency = symbolMap[userCurrency] || '$';

  const rows = [];
  const errors = [];

  records.slice(0, env.MAX_CSV_ROWS).forEach((record, index) => {
    // Pull values through the detected header map (order-independent).
    const raw = {};
    ['date', 'amount', 'description', 'type', 'category', 'notes'].forEach((field) => {
      raw[field] = map[field] !== undefined ? record[map[field]] : undefined;
    });

    const amountValue = parseAmount(raw.amount);
    const dateValue = parseDateValue(raw.date);
    const rowNumber = index + 2; // header is line 1

    const rowErrors = [];
    if (!dateValue) rowErrors.push('Invalid or missing date');
    if (!Number.isFinite(amountValue) || amountValue <= 0) rowErrors.push('Invalid or missing amount');
    if (dateValue && dateValue > new Date(Date.now() + 86400000)) rowErrors.push('Date is in the future');

    const description = String(raw.description || '').trim().slice(0, 200);
    const type = detectType(raw.type, String(raw.amount || '').trim().startsWith('-') ? -1 : amountValue);
    const csvCategoryName = String(raw.category || '').trim().toLowerCase();
    const matchedCategory = csvCategoryName ? categoriesByName.get(csvCategoryName) : null;

    rows.push({
      rowNumber,
      date: dateValue ? dateValue.toISOString() : null,
      amount: Number.isFinite(amountValue) ? amountValue : null,
      description,
      notes: String(raw.notes || '').slice(0, 200),
      type,
      csvCategory: raw.category ? String(raw.category) : '',
      matchedCategoryId: matchedCategory?._id || null,
      errors: rowErrors,
      valid: rowErrors.length === 0,
    });
  });

  const invalidCount = rows.filter((r) => !r.valid).length;
  const validRows = rows.filter((r) => r.valid);
  const truncated = records.length > env.MAX_CSV_ROWS;

  if (truncated) errors.push(`Only the first ${env.MAX_CSV_ROWS} rows were read; the rest of the file was ignored.`);

  // Duplicate detection against existing data (same date + amount + type).
  const existing = await Transaction.find({
    user: user._id,
    date: { $gte: new Date(Date.now() - 365 * 86400000) },
  }).select('date amount type description').lean();
  const fingerprint = (t) => `${new Date(t.date).toISOString().slice(0, 10)}|${round2(t.amount)}|${t.type}`;
  const existingKeys = new Set(existing.map(fingerprint));

  validRows.forEach((row) => {
    row.isDuplicate = existingKeys.has(fingerprint({ date: row.date, amount: row.amount, type: row.type }));
  });

  // Category suggestions (rules first; single AI batch call if configured).
  const suggestionTargets = validRows.filter((r) => !r.matchedCategoryId || r.type);
  const { suggestions, aiUsed, aiConfigured } = await categorizationService.suggestBatch({
    userId: user._id,
    rows: suggestionTargets.map((r, i) => ({ id: r.rowNumber, description: r.description || `${r.type} entry`, type: r.type, amount: r.amount })),
    currency,
    useAi: useAi && validRows.length <= 200,
  });

  validRows.forEach((row) => {
    const suggested = suggestions.get(String(row.rowNumber)) || null;
    const fallbackCategory =
      categoriesByName.get(row.type === 'income' ? 'other income' : 'miscellaneous') ||
      userCategories.find((c) => c.type === row.type);

    row.suggestedCategory = row.matchedCategoryId
      ? userCategories.find((c) => String(c._id) === String(row.matchedCategoryId))
      : suggested?.categoryId
        ? { _id: suggested.categoryId, name: suggested.categoryName }
        : fallbackCategory
          ? { _id: fallbackCategory._id, name: fallbackCategory.name }
          : null;

    row.suggestionSource = row.matchedCategoryId ? 'csv_column' : suggested?.source || 'fallback';
    row.suggestionConfidence = row.matchedCategoryId ? 1 : suggested?.confidence ?? null;
    row.needsReview = !row.matchedCategoryId && (row.suggestionSource === 'fallback' || (suggested?.confidence ?? 0) < 0.6 || !row.description);
  });

  const batchId = crypto.randomBytes(8).toString('hex');

  return {
    batchId,
    columns: { detected: normalised, mapped: map, required: REQUIRED_COLUMNS, optional: OPTIONAL_COLUMNS },
    rows,
    summary: {
      total: rows.length,
      valid: validRows.length,
      invalid: invalidCount,
      duplicates: validRows.filter((r) => r.isDuplicate).length,
      needsReview: validRows.filter((r) => r.needsReview).length,
      willImport: validRows.length,
      totalAmount: round2(validRows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)),
      totalIncome: round2(validRows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)),
      truncated,
    },
    categories: userCategories.map((c) => ({ id: c._id, name: c.name, type: c.type, color: c.color, icon: c.icon })),
    ai: { used: aiUsed, configured: aiConfigured },
    errors,
    currency,
  };
}

/**
 * Commit the reviewed rows.
 * @param {object} params
 * @param {object} params.user
 * @param {Array} params.rows rows from the preview with user decisions applied
 * @param {boolean} [params.skipDuplicates]
 */
async function commit({ user, rows = [], skipDuplicates = true }) {
  if (!Array.isArray(rows) || !rows.length) throw ApiError.badRequest('There is nothing to import');

  const categories = await Category.find({ user: user._id }).lean();
  const categoryIds = new Set(categories.map((c) => String(c._id)));
  const defaultCategory = (type) =>
    categories.find((c) => c.name === (type === 'income' ? 'Other Income' : 'Miscellaneous')) || categories.find((c) => c.type === type);

  const importBatch = crypto.randomBytes(8).toString('hex');
  const imported = [];
  const skipped = [];
  const failed = [];

  for (const row of rows) {
    if (row.skip) {
      skipped.push({ rowNumber: row.rowNumber, reason: 'Skipped by user' });
      continue;
    }
    if (skipDuplicates && row.isDuplicate && !row.forceDuplicate) {
      skipped.push({ rowNumber: row.rowNumber, reason: 'Possible duplicate' });
      continue;
    }

    const amount = parseAmount(row.amount);
    const date = parseDateValue(row.date);
    if (!Number.isFinite(amount) || amount <= 0 || !date) {
      failed.push({ rowNumber: row.rowNumber, reason: 'Invalid date or amount' });
      continue;
    }

    const type = row.type === 'income' ? 'income' : 'expense';
    let categoryId = row.categoryId && categoryIds.has(String(row.categoryId)) ? row.categoryId : null;
    if (!categoryId) {
      const matched = categories.find((c) => c.name.toLowerCase() === String(row.categoryName || row.csvCategory || '').toLowerCase() && c.type === type);
      categoryId = matched?._id || defaultCategory(type)?._id;
    }
    if (!categoryId) {
      failed.push({ rowNumber: row.rowNumber, reason: 'No matching category' });
      continue;
    }

    imported.push({
      user: user._id,
      category: categoryId,
      type,
      amount,
      description: String(row.description || '').slice(0, 200),
      notes: String(row.notes || '').slice(0, 500),
      date,
      source: 'csv',
      importBatch,
      aiSuggestedCategory: row.suggestedCategoryId || null,
      aiSource: row.suggestionSource === 'ai' ? 'ai' : row.suggestionSource === 'rules' ? 'rules' : null,
      aiConfidence: row.suggestionConfidence ?? null,
      userConfirmedCategory: categoryId,
      aiSuggestionAccepted: row.suggestedCategoryId ? String(row.suggestedCategoryId) === String(categoryId) : null,
    });
  }

  let inserted = [];
  if (imported.length) {
    inserted = await Transaction.insertMany(imported, { ordered: false });
    // Re-evaluate budgets for each affected month (deduped).
    const months = [...new Set(inserted.map((t) => `${t.date.getUTCFullYear()}-${t.date.getUTCMonth()}`))];
    for (const key of months) {
      const [y, m] = key.split('-').map(Number);
      // eslint-disable-next-line no-await-in-loop
      await budgetService.evaluateAndAlert(user._id, { month: new Date(Date.UTC(y, m, 1)), currency: tranCurrency(user) });
    }
  }

  await notificationService.notify({
    user: user._id,
    ...notificationService.NOTIFICATION_TEMPLATES.import(inserted.length, skipped.length),
    dedupeKey: `import:${importBatch}`,
    meta: { importBatch, imported: inserted.length, skipped: skipped.length, failed: failed.length },
  });
  await activityService.logActivity({
    user: user._id, action: 'import', entity: 'transaction', label: `${inserted.length} transactions imported`, meta: { importBatch },
  });

  logger.info(`CSV import ${importBatch}: ${inserted.length} imported, ${skipped.length} skipped, ${failed.length} failed`);

  return {
    importBatch,
    imported: inserted.length,
    skipped: skipped.length,
    failed: failed.length,
    skipDetails: skipped.slice(0, 25),
    failDetails: failed.slice(0, 25),
    totalAmount: round2(inserted.reduce((s, t) => s + t.amount, 0)),
  };
}

function tranCurrency(user) {
  const map = { USD: '$', PKR: 'Rs', INR: '₹', EUR: '€', GBP: '£', AED: 'AED', SAR: 'SAR', BDT: '৳' };
  return map[user?.preferences?.currency] || '$';
}

/** Roll back an entire import batch. */
async function undoBatch(user, importBatch) {
  const result = await Transaction.deleteMany({ user: user._id, importBatch });
  await activityService.logActivity({
    user: user._id, action: 'delete', entity: 'transaction', label: `Undid import (${result.deletedCount} removed)`, meta: { importBatch },
  });
  return { deleted: result.deletedCount };
}

/** Template CSV download so users know the expected format. */
const template = () =>
  ['date,description,amount,type,category', '2026-08-02,Campus cafe burger,7.50,expense,Food', '2026-08-05,Monthly allowance,350,income,Allowance', '2026-08-07,Netflix monthly payment,12.99,expense,Subscriptions', ''].join('\n');

module.exports = { preview, commit, undoBatch, template, parseAmount, parseDateValue, mapHeaders };
