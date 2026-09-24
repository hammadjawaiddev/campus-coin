/**
 * Centralised environment configuration.
 * Values are validated once at boot so that missing critical config fails fast
 * with a readable message instead of crashing somewhere deep in a request.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../../.env') });

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const env = {
  NODE_ENV,
  isProd,
  isTest,
  PORT: toInt(process.env.PORT, 5000),
  HOST: process.env.HOST || '0.0.0.0',

  // Database -------------------------------------------------------------
  MONGODB_URI:
    process.env.MONGODB_URI ||
    (isTest ? 'mongodb://127.0.0.1:27017/campuscoin_test' : 'mongodb://127.0.0.1:27017/campuscoin'),

  // Auth -----------------------------------------------------------------
  JWT_SECRET: process.env.JWT_SECRET || (isProd ? '' : 'campus-coin-dev-secret-change-me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  RESET_TOKEN_TTL_MINUTES: toInt(process.env.RESET_TOKEN_TTL_MINUTES, 30),

  // URLs / CORS ----------------------------------------------------------
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  SERVER_URL: process.env.SERVER_URL || `http://localhost:${toInt(process.env.PORT, 5000)}`,
  // Comma separated list of extra origins (preview URLs, staging, ...)
  EXTRA_ORIGINS: (process.env.EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Email ----------------------------------------------------------------
  EMAIL_HOST: process.env.EMAIL_HOST || '',
  EMAIL_PORT: toInt(process.env.EMAIL_PORT, 587),
  EMAIL_SECURE: toBool(process.env.EMAIL_SECURE, false),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Campus Coin <no-reply@campuscoin.app>',

  // AI (OpenAI compatible) ----------------------------------------------
  AI_API_KEY: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
  AI_BASE_URL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  AI_MODEL: process.env.AI_MODEL || 'gpt-4o-mini',
  AI_TIMEOUT_MS: toInt(process.env.AI_TIMEOUT_MS, 20000),

  // Uploads --------------------------------------------------------------
  MAX_CSV_SIZE_MB: toInt(process.env.MAX_CSV_SIZE_MB, 5),
  MAX_CSV_ROWS: toInt(process.env.MAX_CSV_ROWS, 2000),

  // Misc -----------------------------------------------------------------
  RATE_LIMIT_WINDOW_MINUTES: toInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 15),
  RATE_LIMIT_MAX: toInt(process.env.RATE_LIMIT_MAX, 600),
  AUTH_RATE_LIMIT_MAX: toInt(process.env.AUTH_RATE_LIMIT_MAX, 25),
  SEED_DEMO_PASSWORD: process.env.SEED_DEMO_PASSWORD || 'CampusCoin123',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || 'AdminCoin123',
  LOG_LEVEL: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
};

env.isEmailConfigured = Boolean(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASSWORD);
env.isAiConfigured = Boolean(env.AI_API_KEY);

if (!isTest && env.isProd && !env.JWT_SECRET) {
  // Refuse to boot a production server with a predictable signing key.
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

if (!env.isProd && !env.JWT_SECRET) {
  env.JWT_SECRET = 'campus-coin-dev-secret-change-me';
}

module.exports = env;
