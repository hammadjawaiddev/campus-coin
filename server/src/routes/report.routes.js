const express = require('express');
const { body, query } = require('express-validator');
const controller = require('../controllers/reportController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { heavyLimiter } = require('../middleware/security');

const router = express.Router();
router.use(protect);

const filters = [
  query('from').optional().isISO8601().withMessage('Invalid start date'),
  query('to').optional().isISO8601().withMessage('Invalid end date'),
  query('month').optional().matches(/^\d{4}-\d{2}$/),
  query('category').optional().isMongoId(),
  query('type').optional().isIn(['income', 'expense']),
];

router.get('/', validate(filters), controller.get);
router.get('/export.csv', heavyLimiter, validate(filters), controller.exportCsv);
router.post(
  '/save',
  validate([
    body('rangeLabel').optional().trim().isLength({ max: 80 }),
    body('note').optional().trim().isLength({ max: 300 }),
  ]),
  controller.save,
);

module.exports = router;
