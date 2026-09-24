const express = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/insightController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', validate([query('month').optional().matches(/^\d{4}-\d{2}$/)]), controller.listTips);
router.post('/generate', controller.generateTips);
router.get('/weekly-cap/:categoryName', controller.weeklyCap);
router.post(
  '/:id/:action(pin|dismiss|restore|bookmark)',
  validate([param('id').isMongoId(), body('value').optional().isBoolean()]),
  controller.updateTip,
);

module.exports = router;
