const express = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/adminController');
const { validate } = require('../middleware/validate');
const { protect, requireAdmin } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

const router = express.Router();

/**
 * The admin area reuses the standard /api/auth/login endpoint (the same JWT,
 * with role=admin). Every route below is gated by `protect` + `requireAdmin`,
 * so front-end route guards are never the only defence.
 */

router.get('/dashboard', protect, requireAdmin, controller.dashboard);

router.get(
  '/users',
  protect,
  requireAdmin,
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('status').optional().isIn(['active', 'disabled', 'all']),
    query('role').optional().isIn(['student', 'admin', 'all']),
  ]),
  controller.listUsers,
);
router.get('/users/:id', protect, requireAdmin, validate([param('id').isMongoId()]), controller.getUserDetail);
router.patch(
  '/users/:id/status',
  protect,
  requireAdmin,
  validate([param('id').isMongoId(), body('isActive').isBoolean().withMessage('Provide isActive')]),
  controller.setUserStatus,
);
router.post(
  '/users/:id/reset-password',
  protect,
  requireAdmin,
  authLimiter,
  validate([param('id').isMongoId(), body('newPassword').isLength({ min: 8, max: 72 }).withMessage('Temporary password must be at least 8 characters')]),
  controller.resetUserPassword,
);
router.get('/users/:id/activity', protect, requireAdmin, validate([param('id').isMongoId()]), controller.getUserActivity);

router.get('/categories', protect, requireAdmin, controller.listTemplates);
router.post(
  '/categories',
  protect,
  requireAdmin,
  validate([
    body('name').trim().isLength({ min: 1, max: 40 }).withMessage('Name is required'),
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  ]),
  controller.createTemplate,
);
router.post('/categories/apply-to-all', protect, requireAdmin, controller.applyToAllStudents);
router.put('/categories/:id', protect, requireAdmin, validate([param('id').isMongoId()]), controller.updateTemplate);
router.delete('/categories/:id', protect, requireAdmin, validate([param('id').isMongoId()]), controller.deleteTemplate);

router.get('/announcements', protect, requireAdmin, controller.listAnnouncements);
router.post(
  '/announcements',
  protect,
  requireAdmin,
  validate([
    body('title').trim().isLength({ min: 3, max: 120 }).withMessage('Give the announcement a title'),
    body('body').trim().isLength({ min: 5, max: 1200 }).withMessage('Write the announcement body'),
    body('severity').optional().isIn(['info', 'success', 'warning', 'danger']),
    body('audience').optional().isIn(['all', 'new_users', 'admins']),
  ]),
  controller.createAnnouncement,
);
router.put('/announcements/:id', protect, requireAdmin, validate([param('id').isMongoId()]), controller.updateAnnouncement);
router.delete('/announcements/:id', protect, requireAdmin, validate([param('id').isMongoId()]), controller.deleteAnnouncement);

router.get('/analytics', protect, requireAdmin, controller.analyticsOverview);
router.get('/transactions', protect, requireAdmin, controller.listAllTransactions);
router.post('/maintenance/recompute-insights', protect, requireAdmin, controller.recomputeInsights);

module.exports = router;
