const util = require('util');
const env = require('../config/env');

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

function write(level, args) {
  if (LEVELS[level] > LEVELS[env.LOG_LEVEL]) return;
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${level.toUpperCase()} ${util.format(...args)}`;
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

const logger = {
  error: (...args) => write('error', args),
  warn: (...args) => write('warn', args),
  info: (...args) => write('info', args),
  debug: (...args) => write('debug', args),
};

module.exports = { logger };
