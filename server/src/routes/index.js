const express = require('express');
const env = require('../config/env');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');
const { ok } = require('../utils/response');
const { mongoose } = require('../config/db');
const { CURRENCIES, ACADEMIC_YEARS, DEFAULT_CATEGORIES, CATEGORY_ICON_CHOICES, CATEGORY_COLOR_CHOICES } = require('../config/constants');

const router = express.Router();

/**
 * GET /api/health
 * Used by the client status strip, deployment probes and the README smoke test.
 */
router.get('/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return ok(
    res,
    {
      status: mongoose.connection.readyState === 1 ? 'healthy' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date(),
      environment: env.NODE_ENV,
      database: {
        state: states[mongoose.connection.readyState] || 'unknown',
        name: mongoose.connection.name || null,
        host: mongoose.connection.host || null,
      },
      services: {
        ai: aiService.status(),
        email: emailService.status(),
        smtp: emailService.status().configured ? 'configured' : 'not configured (reset links are logged)',
      },
      version: require('../../package.json').version,
    },
    mongoose.connection.readyState === 1 ? 'Campus Coin API is healthy' : 'API is up but the database is not connected',
    null,
    mongoose.connection.readyState === 1 ? 200 : 503,
  );
});

/** GET /api/config — public reference data for forms and settings screens. */
router.get('/config', (_req, res) =>
  ok(
    res,
    {
      currencies: CURRENCIES,
      academicYears: ACADEMIC_YEARS,
      defaults: {
        categories: DEFAULT_CATEGORIES.map(({ name, type, icon, color, keywords }) => ({ name, type, icon, color, keywords })),
        icons: CATEGORY_ICON_CHOICES,
        colors: CATEGORY_COLOR_CHOICES,
      },
      features: {
        ai: aiService.status().configured,
        email: emailService.status().configured,
        csvImport: true,
        pdfExport: true,
      },
      brand: {
        name: 'Campus Coin',
        tagline: 'Smart Spending, Student Style',
        theme: 'NextGen BudgetBee',
      },
    },
    'Public configuration',
  ),
);

// ── Feature routers ────────────────────────────────────────────────────────
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/transactions', require('./transaction.routes'));
router.use('/categories', require('./category.routes'));
router.use('/budgets', require('./budget.routes'));
router.use('/goals', require('./goal.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/insights', require('./insight.routes'));
router.use('/tips', require('./tip.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/bookmarks', require('./bookmark.routes'));
router.use('/reports', require('./report.routes'));
router.use('/import', require('./import.routes'));
router.use('/announcements', require('./announcement.routes'));
router.use('/search', require('./search.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;
