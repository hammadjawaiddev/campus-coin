const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { logger } = require('../utils/logger');

/** Translate framework/driver errors into ApiError instances. */
const normalise = (err) => {
  if (err instanceof ApiError) return err;

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new ApiError(400, 'Please correct the highlighted fields', details);
  }

  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid value for "${err.path}"`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    const pretty = { email: 'An account with this email already exists', name: 'A category with this name already exists' };
    return ApiError.conflict(pretty[field] || `That ${field} is already in use`, err.keyValue || null);
  }

  if (err.name === 'JsonWebTokenError') return ApiError.unauthorized('Invalid session token');
  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Your session has expired. Please sign in again.', { code: 'TOKEN_EXPIRED' });
  }
  if (err.type === 'entity.too.large') return new ApiError(413, 'Request payload is too large');
  if (err.code === 'LIMIT_FILE_SIZE') return new ApiError(413, 'File is larger than the allowed size');
  if (err.message === 'Not allowed by CORS') return ApiError.forbidden('Origin is not allowed by CORS policy');

  if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongooseServerSelectionError'
  ) {
    return ApiError.unavailable('Database is temporarily unreachable. Please retry in a moment.');
  }

  return new ApiError(500, env.isProd ? 'Something went wrong on our side' : err.message, null);
};

const notFoundHandler = (req, _res, next) =>
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const error = normalise(err);
  const status = error.statusCode || 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} →`, err.stack || err.message);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} → ${status} ${error.message}`);
  }

  res.status(status).json({
    success: false,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
};

module.exports = { errorHandler, notFoundHandler, normalise };
