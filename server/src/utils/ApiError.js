/**
 * Operational error with an HTTP status code + optional field level details.
 * Anything that is *not* an ApiError is treated as an unexpected server error
 * by the central error handler (and hidden from the client in production).
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Invalid request', details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'You are not authorised to perform this action') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to access this resource') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists', details = null) {
    return new ApiError(409, message, details);
  }

  static tooMany(message = 'Too many requests, please slow down') {
    return new ApiError(429, message);
  }

  static server(message = 'Something went wrong on our side', details = null) {
    return new ApiError(500, message, details);
  }

  static unavailable(message = 'Service temporarily unavailable', details = null) {
    return new ApiError(503, message, details);
  }
}

module.exports = ApiError;
