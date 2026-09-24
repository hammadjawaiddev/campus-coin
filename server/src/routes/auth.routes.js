const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const { ACADEMIC_YEARS, CURRENCIES } = require('../config/constants');

const router = express.Router();

const passwordRule = (field = 'password') =>
  body(field)
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number');

router.post(
  '/register',
  authLimiter,
  validate([
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Please enter your full name'),
    body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    passwordRule(),
    body('academicYear').optional({ values: 'falsy' }).isIn(ACADEMIC_YEARS).withMessage('Choose a valid academic year'),
    body('monthlyAllowance').optional({ values: 'falsy' }).isFloat({ min: 0, max: 1000000 }).withMessage('Allowance must be a positive number'),
    body('savingsGoal').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100000000 }).withMessage('Savings goal must be a positive number'),
    body('currency').optional({ values: 'falsy' }).isIn(CURRENCIES.map((c) => c.code)).withMessage('Unsupported currency'),
  ]),
  authController.register,
);

router.post(
  '/login',
  authLimiter,
  validate([
    body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Enter your password'),
  ]),
  authController.login,
);

router.post('/logout', authController.logout);
router.get('/me', protect, authController.me);

router.post(
  '/forgot-password',
  authLimiter,
  validate([body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail()]),
  authController.forgotPassword,
);

router.post(
  '/reset-password',
  authLimiter,
  validate([
    body('token').notEmpty().withMessage('Reset token is missing'),
    passwordRule(),
  ]),
  authController.resetPassword,
);

router.get('/reset-password/:token', validate([param('token').isLength({ min: 20 }).withMessage('Invalid reset token')]), authController.verifyResetToken);

router.put(
  '/password',
  protect,
  validate([body('currentPassword').notEmpty().withMessage('Enter your current password'), passwordRule('newPassword')]),
  authController.changePassword,
);

router.post(
  '/onboarding',
  protect,
  validate([
    body('name').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 80 }),
    body('academicYear').optional({ values: 'falsy' }).isIn(ACADEMIC_YEARS),
    body('monthlyAllowance').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    body('savingsGoal').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    body('currency').optional({ values: 'falsy' }).isIn(CURRENCIES.map((c) => c.code)),
  ]),
  authController.completeOnboarding,
);

module.exports = router;
