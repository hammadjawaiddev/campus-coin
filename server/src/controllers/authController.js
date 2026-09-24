const crypto = require('crypto');
const User = require('../models/User');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { signToken } = require('../middleware/auth');
const env = require('../config/env');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const activityService = require('../services/activityService');
const { DEFAULT_CATEGORIES } = require('../config/constants');
const { logger } = require('../utils/logger');

/** Cookie options for the httpOnly session cookie (the JWT is also returned in JSON). */
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

/** Copies the global default categories so the new student can edit/delete freely. */
async function cloneDefaultCategories(userId) {
  const templates = await Category.find({ isTemplate: true, isArchived: false, user: null }).lean();
  const source = templates.length
    ? templates
    : DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i, isDefault: true, keywords: c.keywords }));

  const docs = source.map((c) => ({
    user: userId,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    keywords: c.keywords || [],
    isDefault: true,
    order: c.order || 0,
    monthlyBudgetHint: c.monthlyBudgetHint || 0,
  }));

  if (docs.length) await Category.insertMany(docs, { ordered: false });
  return docs.length;
}

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, academicYear, monthlyAllowance, savingsGoal, currency } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name,
    email,
    password,
    academicYear: academicYear || null,
    monthlyAllowance: monthlyAllowance || 0,
    savingsGoal: savingsGoal || 0,
    preferences: { currency: currency || 'USD' },
  });

  await cloneDefaultCategories(user._id);
  await notificationService.notify({ user: user._id, ...notificationService.NOTIFICATION_TEMPLATES.welcome(user.name) });
  await activityService.logActivity({ user: user._id, action: 'create', entity: 'auth', label: 'Account created' });
  emailService.sendWelcome({ to: user.email, name: user.name }).catch((error) => logger.debug('welcome email skipped:', error.message));

  const token = signToken(user);
  res.cookie('campus_coin_token', token, cookieOptions());
  return created(res, { token, user: user.toPublicJSON() }, 'Welcome to Campus Coin!');
});

/** POST /api/auth/login — also used by the admin login screen. */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw ApiError.unauthorized('Incorrect email or password');
  if (!user.isActive) throw ApiError.forbidden(user.disabledReason || 'This account has been disabled');

  const matches = await user.comparePassword(password);
  if (!matches) throw ApiError.unauthorized('Incorrect email or password');

  user.lastLoginAt = new Date();
  user.loginCount += 1;
  await user.save({ validateBeforeSave: false });
  await activityService.logActivity({ user: user._id, action: 'login', entity: 'auth', label: 'Signed in' });

  const token = signToken(user);
  res.cookie('campus_coin_token', token, cookieOptions());
  return ok(res, { token, user: user.toPublicJSON() }, `Welcome back, ${user.name.split(' ')[0]}!`);
});

/** POST /api/auth/logout */
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('campus_coin_token', { ...cookieOptions(), maxAge: undefined });
  if (req.user) {
    await activityService.logActivity({ user: req.user._id, action: 'logout', entity: 'auth', label: 'Signed out' });
  }
  return ok(res, null, 'You have been signed out');
});

/** GET /api/auth/me — used to rehydrate the session on page load. */
const me = asyncHandler(async (req, res) => {
  const [categoryCount, transactionCount] = await Promise.all([
    Category.countDocuments({ user: req.user._id, isArchived: false }),
    require('../models/Transaction').countDocuments({ user: req.user._id }),
  ]);
  return ok(res, { user: req.user.toPublicJSON(), stats: { categoryCount, transactionCount } }, 'Session active');
});

/** POST /api/auth/forgot-password */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  // Always answer identically so accounts cannot be enumerated.
  const genericMessage = 'If that email is registered, a reset link is on its way.';

  if (!user) {
    return ok(res, { delivered: false }, genericMessage);
  }

  const rawToken = user.createPasswordResetToken(env.RESET_TOKEN_TTL_MINUTES);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
  const delivery = await emailService.sendPasswordReset({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresInMinutes: env.RESET_TOKEN_TTL_MINUTES,
  });

  return ok(
    res,
    {
      delivered: delivery.delivered,
      // In development the link is returned so the flow is demoable without SMTP.
      ...(delivery.delivered ? {} : { devResetUrl: delivery.previewUrl, hint: delivery.reason === 'smtp_not_configured' ? 'SMTP is not configured — set EMAIL_* variables to send real email.' : undefined }),
      expiresInMinutes: env.RESET_TOKEN_TTL_MINUTES,
    },
    genericMessage,
  );
});

/** POST /api/auth/reset-password */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token) throw ApiError.badRequest('Reset token is missing');

  const hashed = User.hashResetToken(token);
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');

  user.password = password;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  await notificationService.notify({
    user: user._id,
    type: 'announcement',
    title: 'Your password was changed',
    message: 'If this was not you, reset your password immediately and review your recent transactions.',
    severity: 'warning',
    link: '/settings',
    dedupeKey: `pwd-reset:${user._id}:${Date.now()}`,
  });

  const jwt = signToken(user);
  res.cookie('campus_coin_token', jwt, cookieOptions());
  return ok(res, { token: jwt, user: user.toPublicJSON() }, 'Password updated — you are signed in.');
});

/** GET /api/auth/reset-password/:token — validates a link before the form renders. */
const verifyResetToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: new Date() } }).select('_id email');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  return ok(res, { valid: true, email: user.email }, 'Reset link is valid');
});

/** PUT /api/auth/password — change password while signed in. */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Your current password is incorrect');
  if (currentPassword === newPassword) throw ApiError.badRequest('Please choose a password different from your current one');

  user.password = newPassword;
  await user.save();

  const jwt = signToken(user);
  res.cookie('campus_coin_token', jwt, cookieOptions());
  return ok(res, { token: jwt }, 'Password changed successfully');
});

/** POST /api/auth/onboarding — completes the guided first-run flow. */
const completeOnboarding = asyncHandler(async (req, res) => {
  const { name, academicYear, monthlyAllowance, savingsGoal, currency, checklist } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (academicYear !== undefined) user.academicYear = academicYear || null;
  if (monthlyAllowance !== undefined) user.monthlyAllowance = Number(monthlyAllowance) || 0;
  if (savingsGoal !== undefined) user.savingsGoal = Number(savingsGoal) || 0;
  if (currency) user.preferences.currency = currency;
  if (checklist) user.onboarding.dismissedChecklist = Boolean(checklist.dismissed);

  user.onboarding.completed = true;
  user.onboarding.completedAt = new Date();
  await user.save();

  return ok(res, { user: user.toPublicJSON() }, 'Onboarding complete — your dashboard is ready');
});

module.exports = {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  changePassword,
  completeOnboarding,
  cloneDefaultCategories,
};
