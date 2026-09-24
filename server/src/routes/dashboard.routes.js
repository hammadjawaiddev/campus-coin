const express = require('express');
const controller = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', controller.get);
router.get('/checklist', controller.checklist);
router.get('/forecast', controller.forecast);
router.get('/compare', controller.compare);

module.exports = router;
