const express = require('express');
const { param } = require('express-validator');
const controller = require('../controllers/notificationController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', controller.list);
router.get('/unread-count', controller.unreadCount);
router.post('/read-all', controller.markAllRead);
router.post('/test', controller.sendTest);
router.delete('/read', controller.clearRead);
router.patch('/:id/read', validate([param('id').isMongoId()]), controller.markRead);
router.delete('/:id', validate([param('id').isMongoId()]), controller.dismiss);

module.exports = router;
