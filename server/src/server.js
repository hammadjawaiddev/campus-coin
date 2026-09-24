/* eslint-disable no-console */
const env = require('./config/env');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { logger } = require('./utils/logger');

let server;

async function start() {
  await connectDB();

  server = app.listen(env.PORT, env.HOST, () => {
    logger.info('──────────────────────────────────────────────');
    logger.info(` Campus Coin API  →  http://localhost:${env.PORT}`);
    logger.info(` Environment      :  ${env.NODE_ENV}`);
    logger.info(` Client origin    :  ${env.CLIENT_URL}`);
    logger.info(` AI assistant     :  ${env.isAiConfigured ? `enabled (${env.AI_MODEL})` : 'not configured → rule-based fallback active'}`);
    logger.info(` Email delivery   :  ${env.isEmailConfigured ? 'SMTP configured' : 'not configured → reset links logged to console'}`);
    logger.info('──────────────────────────────────────────────');
  });
}

/** Graceful shutdown so in-flight requests finish and Mongo closes cleanly. */
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  process.exit(0);
};

['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown('uncaughtException');
});

start().catch((error) => {
  logger.error('Failed to start API:', error);
  process.exit(1);
});
