/**
 * Vercel serverless entry for the Campus Coin Express API.
 * Keeps /api on the same origin as the Vite SPA so the browser needs no CORS dance.
 */
const app = require('../server/src/app');
const { connectDB } = require('../server/src/config/db');

let ready;

async function ensureDb() {
  if (!ready) {
    ready = connectDB().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

module.exports = async (req, res) => {
  const env = require('../server/src/config/env');
  if (env.missingJwtSecret) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: 'Server misconfigured: set JWT_SECRET in Vercel Environment Variables, then redeploy.',
        details: { code: 'MISSING_JWT_SECRET' },
      }),
    );
    return;
  }

  try {
    await ensureDb();
  } catch (error) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: 'Database unavailable. Set MONGODB_URI in Vercel and allow 0.0.0.0/0 in Atlas Network Access.',
        details: { code: 'DB_UNAVAILABLE', error: error.message },
      }),
    );
    return;
  }
  return app(req, res);
};
