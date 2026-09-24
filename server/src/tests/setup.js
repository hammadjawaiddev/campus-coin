/* eslint-disable no-console */
/**
 * Jest bootstrap for the API test suite.
 *
 * Every test file runs against a throwaway MongoDB started by
 * mongodb-memory-server, so `npm test` never touches the development database.
 *
 * If a `mongod` binary is already available on the machine (for example the one
 * the project uses for local development), point MONGOMS_SYSTEM_BINARY at it to
 * skip the download entirely:
 *   MONGOMS_SYSTEM_BINARY=/opt/mongo/bin/mongod npm test
 */
process.env.NODE_ENV = 'test';

const fs = require('fs');
const mongoose = require('mongoose');

// Prefer a locally installed mongod when one exists.
if (!process.env.MONGOMS_SYSTEM_BINARY) {
  const candidates = ['/opt/mongo/bin/mongod', '/usr/bin/mongod', '/usr/local/bin/mongod'];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) process.env.MONGOMS_SYSTEM_BINARY = found;
}

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'campuscoin_test' });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

/** Wipe every collection between tests so files stay independent. */
beforeEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});
