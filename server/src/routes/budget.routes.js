const express = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/budgetController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { loadOwned } = require('../middleware/ownership');
const Budget = require('../models/Budget');

const router = express.Router();
router.use(protect);

router.get('/', validate([query('month').optional().matches(/^\d{4}-\d{2}(-\d{2})?$/)], ), controller.list);
router.get('/alerts', controller.alerts);
router.get('/insights', controller.insights);
router.get('/usage/:categoryId', validate([param('categoryId').isMongoId()]), controller.categoryUsage);
router.post(
  '/',
  validate([
    body('categoryId').isMongoId().withMessage('Choose a category'),
    body('limitAmount').isFloat({ gt: 0, max: 100000000 }).withMessage('Enter a budget limit greater than zero'),
    body('month').optional().matches(/^\d{4}-\d{2}(-\d{2})?$/).withMessage('Month must look like 2026-08'),
    body('alertThreshold').optional().isInt({ min: 10, max: 150 }),
  ]),
  controller.upsert,
);
router.post('/copy', controller.copyPrevious);
router.post('/reset-alerts', controller.resetAlerts);
router.put('/:id', validate([param('id').isMongoId(), body('limitAmount').optional().isFloat({ gt: 0 })]), loadOwned(Budget), controller.update);
router.delete('/:id', validate([param('id').isMongoId()]), loadOwned(Budget), controller.remove);

module.exports = router;
