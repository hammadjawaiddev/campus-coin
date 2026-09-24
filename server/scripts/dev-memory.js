/* eslint-disable no-console */
/**
 * Run the Campus Coin API with an embedded MongoDB — no database to install.
 *
 *   npm run dev:memory            → start MongoDB (data kept in server/.mongo-data)
 *   npm run dev:memory -- --seed  → also load the demo student + admin accounts
 *   npm run dev:memory -- --fresh → wipe and reload the demo data, then start
 *
 * How it works: mongodb-memory-server downloads a real `mongod` binary once
 * (~70 MB, cached in server/.mongo-bin) and runs it on a free local port with a
 * persistent data directory. The API then boots exactly as it does in
 * production, with MONGODB_URI pointed at that instance.
 *
 * Nothing here is used in production — on a hosted deployment you point
 * MONGODB_URI at MongoDB Atlas or your own cluster.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const wantsSeed = args.includes('--seed') || args.includes('--fresh');
const wantsFresh = args.includes('--fresh');

// Overridable so a throwaway instance can be started without touching the
// real demo data directory.
const DATA_DIR = process.env.CC_MONGO_DATA_DIR || path.resolve(__dirname, '../.mongo-data');
const BIN_DIR = process.env.CC_MONGO_BIN_DIR || path.resolve(__dirname, '../.mongo-bin');

async function main() {
  // eslint-disable-next-line global-require
  const { MongoMemoryServer } = require('mongodb-memory-server');

  // Reuse a locally installed mongod when we can find one (faster, offline).
  if (!process.env.MONGOMS_SYSTEM_BINARY) {
    const candidates = [
      '/opt/mongo/bin/mongod',
      '/usr/bin/mongod',
      '/usr/local/bin/mongod',
      '/opt/homebrew/bin/mongod',
      'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (found) process.env.MONGOMS_SYSTEM_BINARY = found;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });
  // Keep the downloaded binary next to the project so it is easy to delete.
  process.env.MONGOMS_DOWNLOAD_DIR = process.env.MONGOMS_DOWNLOAD_DIR || BIN_DIR;

  console.log('\n▸ Starting an embedded MongoDB (first run downloads the server binary, ~70 MB)…');

  const mongo = await MongoMemoryServer.create({
    instance: {
      dbName: 'campuscoin',
      dbPath: DATA_DIR, // persisted, so your data survives restarts
      storageEngine: 'wiredTiger',
      // Keep the log quiet but available if something goes wrong.
      args: ['--quiet'],
    },
  });

  const uri = mongo.getUri('campuscoin');
  // config/env reads this at require time, so set it before anything else loads.
  process.env.MONGODB_URI = uri;

  const namespace = typeof mongo.instanceInfo?.port === 'number' ? `127.0.0.1:${mongo.instanceInfo.port}` : uri;

  if (wantsSeed) {
    console.log(`▸ Seeding demo data${wantsFresh ? ' (fresh) ' : ' '}— this can take a few seconds…\n`);
    const seed = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../src/seed/seed.js'), ...(wantsFresh ? ['--fresh'] : [])],
      { stdio: 'inherit', cwd: path.resolve(__dirname, '..'), env: { ...process.env, MONGODB_URI: uri } },
    );
    if (seed.status !== 0) {
      console.error('✖ Seeding failed — starting the API anyway so you can inspect the logs.');
    }
  }

  // Boot the API against the embedded instance.
  const app = require('../src/app');
  const { connectDB, disconnectDB } = require('../src/config/db');
  const env = require('../src/config/env');

  await connectDB();

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log('──────────────────────────────────────────────');
    console.log(' Campus Coin API   →  http://localhost:' + env.PORT);
    console.log(' Embedded MongoDB  →  ' + namespace);
    console.log(' Data directory    →  ' + DATA_DIR);
    console.log(` AI assistant      :  ${env.AI_API_KEY ? `enabled (${env.AI_MODEL})` : 'not configured → rule-based fallback active'}`);
    console.log('──────────────────────────────────────────────');
    if (!wantsSeed) {
      console.log(' Tip: run  npm run dev:memory -- --fresh  for the demo student + admin accounts.\n');
    } else {
      console.log(' Demo student  : demo@campuscoin.com  / ' + env.SEED_DEMO_PASSWORD);
      console.log(' Demo admin    : admin@campuscoin.com / ' + env.SEED_ADMIN_PASSWORD);
      console.log(' In another terminal, start the UI with:  cd ../client && npm run dev\n');
    }
  });

  const shutdown = async (signal) => {
    console.log(`\n▸ ${signal} received — stopping API and embedded MongoDB…`);
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB().catch(() => {});
    await mongo.stop().catch(() => {});
    process.exit(0);
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));
}

main().catch((error) => {
  console.error('\n✖ Could not start the embedded database:', error.message);
  console.error('  Fallbacks: install MongoDB Community Edition, or create a free MongoDB Atlas cluster and set MONGODB_URI in server/.env.\n');
  process.exit(1);
});
