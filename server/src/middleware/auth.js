const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.campus_coin_token) return req.cookies.campus_coin_token;
  return null;
};

const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

/** Requires a valid, non-expired JWT for an active account. */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Please sign in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Your session has expired. Please sign in again.', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid session. Please sign in again.');
  }

  // Always re-read the user so a disabled/deleted account loses access instantly.
  const user = await User.findById(payload.sub).select('+password');
  if (!user) throw ApiError.unauthorized('This account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been disabled. Contact support.');

  // Password change invalidates older tokens.
  if (user.passwordChangedAt && payload.iat) {
    const issuedAt = payload.iat * 1000;
    if (issuedAt < user.passwordChangedAt.getTime()) {
      throw new ApiError(401, 'Password was changed. Please sign in again.', { code: 'PASSWORD_CHANGED' });
    }
  }

  req.user = user;
  req.token = token;
  return next();
});

/** Role gate — used by /api/admin/*. Front-end guards are never trusted alone. */
const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Administrator access is required for this resource'));
    }
    return next();
  };

const requireAdmin = requireRole('admin');

/** Attaches req.user when a token is present but never blocks the request. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) req.user = user;
  } catch (_) {
    /* ignore – endpoint is public */
  }
  return next();
});

module.exports = { protect, requireRole, requireAdmin, optionalAuth, signToken, extractToken };
