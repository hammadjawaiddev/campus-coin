const fs = require('fs');
const path = require('path');
const csvService = require('../services/csvService');
const detection = require('../services/detectionService');
const demoData = require('../seed/demoData');
const { ok, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** POST /api/import/preview — multipart upload (field name: file). */
const preview = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Attach a .csv file to continue');
  const result = await csvService.preview({ buffer: req.file.buffer, user: req.user, useAi: req.body.useAi !== 'false' });
  return ok(res, { ...result, filename: req.file.originalname, sizeBytes: req.file.size }, 'File parsed — review the rows below');
});

/** POST /api/import/commit */
const commit = asyncHandler(async (req, res) => {
  const { rows, skipDuplicates = true } = req.body;
  const result = await csvService.commit({ user: req.user, rows, skipDuplicates });
  return created(res, result, `${result.imported} transaction${result.imported === 1 ? '' : 's'} imported`);
});

/** POST /api/import/undo/:batchId */
const undo = asyncHandler(async (req, res) => {
  const result = await csvService.undoBatch(req.user, req.params.batchId);
  return ok(res, result, `${result.deleted} imported transaction${result.deleted === 1 ? '' : 's'} removed`);
});

/** GET /api/import/template — downloadable CSV template. */
const template = asyncHandler(async (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="campus-coin-import-template.csv"');
  return res.send(csvService.template());
});

/** GET /api/import/sample — the bundled sample file (used to demo the flow). */
const sample = asyncHandler(async (_req, res) => {
  const filePath = path.resolve(__dirname, '../../../sample-data/campus-coin-sample-transactions.csv');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="campus-coin-sample-transactions.csv"');
    return res.send(fs.readFileSync(filePath));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="campus-coin-sample-transactions.csv"');
  return res.send(demoData.sampleCsv());
});

/** GET /api/import/history — batches imported by this student. */
const history = asyncHandler(async (req, res) => {
  const Transaction = require('../models/Transaction');
  const batches = await Transaction.aggregate([
    { $match: { user: req.user._id, importBatch: { $ne: null } } },
    {
      $group: {
        _id: '$importBatch',
        count: { $sum: 1 },
        total: { $sum: '$amount' },
        first: { $min: '$createdAt' },
        last: { $max: '$createdAt' },
      },
    },
    { $sort: { last: -1 } },
    { $limit: 20 },
  ]);
  return ok(
    res,
    {
      batches: batches.map((b) => ({ batchId: b._id, count: b.count, total: Math.round(b.total * 100) / 100, importedAt: b.first, updatedAt: b.last })),
      detection: await detection.forecastNextMonth(req.user._id),
    },
    'Import history',
  );
});

module.exports = { preview, commit, undo, template, sample, history };
