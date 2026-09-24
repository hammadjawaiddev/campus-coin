const mongoose = require('mongoose');
const env = require('./env');
const { logger } = require('../utils/logger');

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. Retries a few times so that a container start-up race
 * with the database does not kill the API process.
 */
async function connectDB(uri = env.MONGODB_URI, { attempts = 5, delayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
      });
      logger.info(`MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
      return mongoose.connection;
    } catch (error) {
      lastError = error;
      logger.warn(`MongoDB connection attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB, mongoose };
