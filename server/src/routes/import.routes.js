const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/importController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { csvUpload } = require('../middleware/upload');
const { heavyLimiter } = require('../middleware/security');
const ApiError = require('../utils/ApiError');

const router = express.Router();
router.use(protect);

/** Multer errors (size limit, wrong type) become clean 4xx responses. */
const handleUpload = (req, res, next) =>
  csvUpload(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'That file is larger than the allowed upload size'));
    return next(error);
  });

router.post('/preview', heavyLimiter, handleUpload, controller.preview);
router.post(
  '/commit',
  validate([body('rows').isArray({ min: 1, max: 2000 }).withMessage('Nothing to import')]),
  controller.commit,
);
router.post('/undo/:batchId', validate([param('batchId').isLength({ min: 4, max: 64 })]), controller.undo);
router.get('/history', controller.history);
router.get('/template', controller.template);
router.get('/sample', controller.sample);

module.exports = router;
