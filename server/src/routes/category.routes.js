const express = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/categoryController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { loadOwned } = require('../middleware/ownership');
const Category = require('../models/Category');

const router = express.Router();
router.use(protect);

const categoryRules = (isUpdate = false) => [
  body('name').if(() => !isUpdate).trim().isLength({ min: 1, max: 40 }).withMessage('Give your category a name'),
  body('name').optional().trim().isLength({ min: 1, max: 40 }),
  body('type').if(() => !isUpdate).isIn(['income', 'expense']).withMessage('Choose income or expense'),
  body('icon').optional().isString().isLength({ max: 40 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Colour must be a hex value like #6D5DFB'),
  body('keywords').optional().isArray({ max: 12 }).withMessage('Up to 12 keywords'),
];

router.get('/', validate([query('type').optional().isIn(['income', 'expense'])]), controller.list);
router.post('/', validate(categoryRules(false)), controller.create);
router.post('/restore-defaults', controller.restoreDefaults);

const owned = loadOwned(Category);
router.get('/:id/usage', validate([param('id').isMongoId()]), owned, controller.usage);
router.put('/:id', validate([param('id').isMongoId(), ...categoryRules(true)]), loadOwned(Category), controller.update);
router.delete('/:id', validate([param('id').isMongoId()]), loadOwned(Category), controller.remove);

module.exports = router;
