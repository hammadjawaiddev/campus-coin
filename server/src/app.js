const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { corsMiddleware, helmetMiddleware, globalLimiter, sanitize } = require('./middleware/security');
const { logger } = require('./utils/logger');

const app = express();

// Behind Render/Railway/Vercel proxies — needed for correct rate limiting + IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Security + parsing ─────────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitize);

// ── Observability ──────────────────────────────────────────────────────────
if (!env.isTest) {
  app.use(
    morgan(env.isProd ? 'combined' : 'dev', {
      stream: { write: (line) => logger.info(line.trim()) },
      skip: (req) => req.originalUrl === '/api/health',
    }),
  );
}

// ── Rate limiting ──────────────────────────────────────────────────────────
app.use('/api', globalLimiter);

// ── API ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

/**
 * Optional single-service deployment: if the client has been built
 * (`client/dist`), serve it from the same origin as the API. That removes CORS
 * from the picture entirely and lets one `npm start` serve the whole product.
 * Disable it with SERVE_CLIENT=false when the SPA is hosted separately
 * (Netlify/Vercel) and only the API runs here.
 */
const clientDist = path.resolve(__dirname, '../../client/dist');
const serveClient = process.env.SERVE_CLIENT !== 'false' && fs.existsSync(path.join(clientDist, 'index.html'));

if (serveClient) {
  app.use(
    express.static(clientDist, {
      index: false,
      maxAge: env.isProd ? '1y' : 0,
      setHeaders: (res, filePath) => {
        // Hashed assets can be cached forever; index.html never is.
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
}

// Convenience redirect so hitting the API root in a browser is not a 404.
app.get('/', (_req, res) => {
  if (serveClient) return res.sendFile(path.join(clientDist, 'index.html'));
  return res.redirect('/api/health');
});

// SPA fallback: deep links such as /dashboard must return index.html.
if (serveClient) {
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ── Errors ─────────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
