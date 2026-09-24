const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('../config/env');

/**
 * CORS: explicit allow-list built from CLIENT_URL + EXTRA_ORIGINS, plus
 * localhost/private-network dev origins and any preview origin passed in.
 * Requests without an Origin header (curl, server-to-server, same-origin
 * production build served by the API) are allowed.
 */
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (env.CLIENT_URL.split(',').map((s) => s.trim()).includes(origin)) return true;
  if (env.EXTRA_ORIGINS.includes(origin)) return true;
  if (origin === 'null') return true; // sandboxed iframe previews
  try {
    const { hostname } = new URL(origin);
    if (env.isProd && !env.EXTRA_ORIGINS.length) {
      // In production only the configured client is allowed.
      return hostname === new URL(env.CLIENT_URL).hostname;
    }
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.e2b.app') ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.netlify.app') ||
      hostname.endsWith('.onrender.com')
    );
  } catch {
    return false;
  }
};

const corsMiddleware = cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
});

const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // the API serves JSON only; the SPA is served elsewhere
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/** Global limiter — generous, mainly a safety net. */
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many requests from this device. Please slow down.' },
});

/** Strict limiter for credential endpoints (brute-force protection). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  message: {
    success: false,
    message: 'Too many attempts. Please wait a few minutes before trying again.',
  },
});

/** Upload/import + AI endpoints are expensive: keep them tighter. */
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'That action is being requested too quickly. Please retry shortly.' },
});

const sanitize = mongoSanitize({ replaceWith: '_', allowDots: false });

module.exports = {
  corsMiddleware,
  helmetMiddleware,
  globalLimiter,
  authLimiter,
  heavyLimiter,
  sanitize,
  isAllowedOrigin,
};
