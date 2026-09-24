const express = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/insightController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { heavyLimiter } = require('../middleware/security');

const router = express.Router();
router.use(protect);

router.get('/', validate([query('limit').optional().isInt({ min: 1, max: 50 })]), controller.list);
router.get('/latest', controller.latest);
router.get('/recommendations', controller.recommendations);
router.get('/accuracy', controller.accuracy);
router.post('/generate', heavyLimiter, validate([body('month').optional().matches(/^\d{4}-\d{2}$/)]), controller.generate);
router.patch('/:id', validate([param('id').isMongoId(), body('status').isIn(['active', 'dismissed'])]), controller.setStatus);
router.post('/:id/bookmark', validate([param('id').isMongoId()]), controller.bookmark);

module.exports = router;
