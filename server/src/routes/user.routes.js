const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/userController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');
const { ACADEMIC_YEARS, CURRENCIES } = require('../config/constants');

const router = express.Router();
router.use(protect);

router.get('/me', controller.getMe);
router.put(
  '/me',
  validate([
    body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name'),
    body('email').optional().isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('academicYear').optional({ values: 'null' }).isIn(ACADEMIC_YEARS).withMessage('Choose a valid academic year'),
    body('monthlyAllowance').optional().isFloat({ min: 0, max: 1000000 }),
    body('savingsGoal').optional().isFloat({ min: 0, max: 100000000 }),
    body('avatar.color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Colour must be a hex value'),
  ]),
  controller.updateMe,
);
router.put(
  '/me/preferences',
  validate([
    body('currency').optional().isIn(CURRENCIES.map((c) => c.code)).withMessage('Unsupported currency'),
    body('theme').optional().isIn(['light', 'dark', 'system']),
    body('fontSize').optional().isIn(['sm', 'base', 'lg']),
  ]),
  controller.updatePreferences,
);
router.get('/me/summary', controller.getSummary);
router.post('/me/digest', controller.sendDigest);
router.get('/me/activity', transactionController.recentActivity);
router.delete('/me', validate([body('password').notEmpty().withMessage('Confirm your password to continue')]), controller.deleteMe);

module.exports = router;
