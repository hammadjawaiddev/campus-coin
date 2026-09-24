const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/** CSV imports are parsed from memory — nothing is written to disk. */
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_CSV_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const okMime = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv', 'application/octet-stream'];
    const okExt = /\.csv$/i.test(file.originalname || '');
    if (okExt || okMime.includes(file.mimetype)) return cb(null, true);
    return cb(ApiError.badRequest('Please upload a .csv file'));
  },
}).single('file');

module.exports = { csvUpload };
