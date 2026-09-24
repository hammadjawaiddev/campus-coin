const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs express-validator chains and converts the result into a 400 ApiError
 * with `details[]` so the client can attach messages to individual fields.
 */
const validate = (chains) => [
  ...chains,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(ApiError.badRequest(details[0].message || 'Validation failed', details));
  },
];

module.exports = { validate };
