const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const emailService = require('../services/emailService');
const activityService = require('../services/activityService');
const { ACADEMIC_YEARS, CURRENCIES } = require('../config/constants');
const { currencySymbol } = require('../services/transactionService');

/** GET /api/users/me */
const getMe = asyncHandler(async (req, res) => ok(res, { user: req.user.toPublicJSON() }, 'Profile loaded'));

/** PUT /api/users/me */
const updateMe = asyncHandler(async (req, res) => {
  const { name, email, academicYear, university, monthlyAllowance, savingsGoal, avatar } = req.body;
  const user = await User.findById(req.user._id);

  if (email && email.toLowerCase() !== user.email) {
    const taken = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (taken) throw ApiError.conflict('That email is already registered');
    user.email = email;
  }

  if (name) user.name = name;
  if (university !== undefined) user.university = university;
  if (academicYear !== undefined) {
    if (academicYear && !ACADEMIC_YEARS.includes(academicYear)) throw ApiError.badRequest('Invalid academic year');
    user.academicYear = academicYear || null;
  }
  if (monthlyAllowance !== undefined) user.monthlyAllowance = Math.max(0, Number(monthlyAllowance) || 0);
  if (savingsGoal !== undefined) user.savingsGoal = Math.max(0, Number(savingsGoal) || 0);
  if (avatar) {
    if (avatar.color) user.avatar.color = avatar.color;
    if (avatar.url !== undefined) user.avatar.url = avatar.url;
  }

  await user.save();
  await activityService.logActivity({ user: user._id, action: 'update', entity: 'system', label: 'Updated profile' });
  return ok(res, { user: user.toPublicJSON() }, 'Profile updated');
});

/** PUT /api/users/me/preferences */
const updatePreferences = asyncHandler(async (req, res) => {
  const { currency, theme, fontSize, reducedMotion, emailAlerts, weeklyDigest } = req.body;
  const user = await User.findById(req.user._id);

  if (currency) {
    if (!CURRENCIES.some((c) => c.code === currency)) throw ApiError.badRequest('Unsupported currency');
    user.preferences.currency = currency;
  }
  if (theme) user.preferences.theme = theme;
  if (fontSize) user.preferences.fontSize = fontSize;
  if (reducedMotion !== undefined) user.preferences.reducedMotion = Boolean(reducedMotion);
  if (emailAlerts !== undefined) user.preferences.emailAlerts = Boolean(emailAlerts);
  if (weeklyDigest !== undefined) user.preferences.weeklyDigest = Boolean(weeklyDigest);

  await user.save();
  return ok(res, { user: user.toPublicJSON() }, 'Preferences saved');
});

/** GET /api/users/me/summary — light stats for the profile page. */
const getSummary = asyncHandler(async (req, res) => {
  const [txCount, first, last] = await Promise.all([
    Transaction.countDocuments({ user: req.user._id }),
    Transaction.findOne({ user: req.user._id }).sort({ date: 1 }).select('date').lean(),
    Transaction.findOne({ user: req.user._id }).sort({ date: -1 }).select('date').lean(),
  ]);
  return ok(
    res,
    {
      transactionCount: txCount,
      firstTransactionAt: first?.date || null,
      lastTransactionAt: last?.date || null,
      streak: req.user.streak,
      currency: req.user.preferences.currency,
      currencySymbol: currencySymbol(req.user),
      memberSince: req.user.createdAt,
    },
    'Account summary',
  );
});

/** POST /api/users/me/digest — sends the monthly summary email on demand. */
const sendDigest = asyncHandler(async (req, res) => {
  const analytics = require('../services/analyticsService');
  const { monthLabel } = require('../utils/date');
  const summary = await analytics.summaryWithComparisons(req.user._id, new Date(), currencySymbol(req.user));
  const result = await emailService.sendMonthlyDigest({
    to: req.user.email,
    name: req.user.name,
    monthLabel: monthLabel(new Date()),
    currency: currencySymbol(req.user),
    totals: { income: summary.current.income, expense: summary.current.expense, net: summary.current.net },
  });
  return ok(
    res,
    { delivered: result.delivered, reason: result.reason || null },
    result.delivered ? 'Monthly summary emailed to you' : 'Email is not configured on this server — the summary was logged instead',
  );
});

/** DELETE /api/users/me — soft delete keeps data integrity for admin analytics. */
const deleteMe = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  const matches = await user.comparePassword(password || '');
  if (!matches) throw ApiError.badRequest('Password confirmation failed');

  user.isActive = false;
  user.disabledReason = 'Account deleted by the student';
  await user.save({ validateBeforeSave: false });
  return ok(res, null, 'Your account has been deactivated. Contact support to restore it.');
});

module.exports = { getMe, updateMe, updatePreferences, getSummary, sendDigest, deleteMe };
