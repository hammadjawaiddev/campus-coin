const express = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/notificationController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', validate([query('itemType').optional().isIn(['tip', 'insight', 'report'])]), controller.listBookmarks);
router.post(
  '/',
  validate([
    body('itemType').isIn(['tip', 'insight', 'report']).withMessage('Unsupported bookmark type'),
    body('itemId').optional({ values: 'null' }).isMongoId(),
    body('title').optional().trim().isLength({ max: 160 }),
  ]),
  controller.createBookmark,
);
router.delete('/:id', validate([param('id').isMongoId()]), controller.removeBookmark);

module.exports = router;
