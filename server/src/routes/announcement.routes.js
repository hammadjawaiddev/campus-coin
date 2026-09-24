const express = require('express');
const Announcement = require('../models/Announcement');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

/**
 * GET /api/announcements
 * Published announcements from the admin panel, visible to every signed-in
 * student (the sitemap's "campus updates" feed).
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const announcements = await Announcement.find({
      isPublished: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .sort({ publishedAt: -1 })
      .limit(20)
      .select('title body kind severity link publishedAt')
      .lean();

    return ok(res, { announcements }, 'Campus announcements');
  }),
);

module.exports = router;
