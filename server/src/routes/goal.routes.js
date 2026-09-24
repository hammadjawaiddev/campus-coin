const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/goalController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { loadOwned } = require('../middleware/ownership');
const SavingsGoal = require('../models/SavingsGoal');

const router = express.Router();
router.use(protect);

router.get('/', controller.list);
router.post(
  '/',
  validate([
    body('name').trim().isLength({ min: 1, max: 80 }).withMessage('Name your goal'),
    body('targetAmount').isFloat({ gt: 0, max: 100000000 }).withMessage('Enter a target amount greater than zero'),
    body('currentAmount').optional().isFloat({ min: 0 }),
    body('targetDate').optional({ values: 'null' }).isISO8601().withMessage('Enter a valid target date'),
  ]),
  controller.create,
);
router.put('/:id', validate([param('id').isMongoId()]), loadOwned(SavingsGoal), controller.update);
router.post('/:id/contribute', validate([param('id').isMongoId(), body('amount').isFloat()]), loadOwned(SavingsGoal), controller.contribute);
router.delete('/:id', validate([param('id').isMongoId()]), loadOwned(SavingsGoal), controller.remove);

module.exports = router;
