const express = require('express');
const { body, query, param } = require('express-validator');
const controller = require('../controllers/transactionController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { heavyLimiter } = require('../middleware/security');
const { RECURRING_FREQUENCIES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const transactionRules = (isUpdate = false) => [
  body('category').if(() => !isUpdate || body('category').exists()).isMongoId().withMessage('Choose a category'),
  body('amount')
    .if(() => !isUpdate)
    .isFloat({ gt: 0, max: 100000000 })
    .withMessage('Enter an amount greater than zero'),
  body('type').optional().isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('date').optional().isISO8601().withMessage('Enter a valid date'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('Description is too long'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes are too long'),
  body('recurring').optional().isBoolean(),
  body('recurringFrequency').optional({ values: 'null' }).isIn(RECURRING_FREQUENCIES).withMessage('Choose a valid frequency'),
];

router.get('/', validate([query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })]), controller.list);
router.get('/meta', controller.meta);
router.get('/activity/recent', controller.recentActivity);
router.get('/recurring', controller.listRecurring);
router.post('/recurring/run', controller.runRecurring);
router.post('/recurring/:id/status', controller.setRecurringStatus);
router.get('/detection/insights', controller.detectionInsights);
router.post('/ai-suggest', heavyLimiter, validate([body('description').trim().notEmpty().withMessage('Enter a description first')]), controller.aiSuggest);
router.post('/precheck', controller.precheck);

router.post('/', validate(transactionRules(false)), controller.create);
router.get('/:id', validate([param('id').isMongoId()]), controller.getOne);
router.put('/:id', validate([param('id').isMongoId(), ...transactionRules(true)]), controller.update);
router.delete('/:id', validate([param('id').isMongoId()]), controller.remove);
router.post('/:id/duplicate', validate([param('id').isMongoId()]), controller.duplicate);

module.exports = router;
