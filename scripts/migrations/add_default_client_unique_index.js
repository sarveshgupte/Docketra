#!/usr/bin/env node
/*
 * Migration: add_default_client_unique_index
 *
 * Purpose:
 * - Enforce exactly one default client per firm.
 * - Keep operation idempotent and safe under repeated deployments.
 *
 * Usage:
 *   node scripts/migrations/add_default_client_unique_index.js up
 *   node scripts/migrations/add_default_client_unique_index.js down
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const direction = (process.argv[2] || 'up').toLowerCase();

const INDEX_NAME = 'org_default_client_unique';
const INDEX_KEY = { firmId: 1, isDefaultClient: 1 };
const INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: { isDefaultClient: true },
  name: INDEX_NAME,
};

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI or MONGO_URI is required');
  process.exit(1);
}

async function ensureIndex(db) {
  await db.collection('clients').createIndex(INDEX_KEY, INDEX_OPTIONS);
  console.log(`✓ ensured clients.${INDEX_NAME}`);
}

async function dropIndex(db) {
  const existing = await db.collection('clients').indexes();
  const names = new Set(existing.map((indexSpec) => indexSpec.name));
  if (!names.has(INDEX_NAME)) {
    console.log(`- skip clients.${INDEX_NAME} (not present)`);
    return;
  }

  await db.collection('clients').dropIndex(INDEX_NAME);
  console.log(`✓ dropped clients.${INDEX_NAME}`);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  try {
    const db = mongoose.connection.db;
    if (direction === 'down') {
      await dropIndex(db);
      return;
    }

    await ensureIndex(db);
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
