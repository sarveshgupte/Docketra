#!/usr/bin/env node
/*
 * Migration: add_multi_tenant_indexes
 *
 * Purpose:
 * - Add firm-first compound indexes for tenant-scoped case/workbasket/dashboard queries.
 * - Keep operations idempotent and production-safe.
 *
 * Usage:
 *   node scripts/migrations/add_multi_tenant_indexes.js up
 *   node scripts/migrations/add_multi_tenant_indexes.js down
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const direction = (process.argv[2] || 'up').toLowerCase();

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI or MONGO_URI is required');
  process.exit(1);
}

const INDEX_DEFINITIONS = {
  cases: [
    { key: { firmId: 1, status: 1 }, name: 'idx_cases_tenant_status' },
    { key: { firmId: 1, assignedToXID: 1 }, name: 'idx_cases_tenant_assigned' },
    { key: { firmId: 1, dueDate: 1 }, name: 'idx_cases_tenant_due' },
    { key: { firmId: 1, createdAt: 1 }, name: 'idx_cases_tenant_created' },
    { key: { firmId: 1, status: 1, dueDate: 1 }, name: 'idx_cases_tenant_status_due' },
    { key: { firmId: 1, assignedToXID: 1, status: 1 }, name: 'idx_cases_tenant_assigned_status' },
    { key: { firmId: 1, status: 1, createdAt: -1 }, name: 'idx_cases_tenant_status_created_desc' },
    {
      key: { firmId: 1, dueDate: 1 },
      name: 'idx_cases_active_due',
      partialFilterExpression: { status: { $ne: 'RESOLVED' } },
    },
  ],
  casehistories: [
    { key: { firmId: 1, caseId: 1, timestamp: -1 }, name: 'idx_case_history_tenant_entity_created_desc' },
    { key: { firmId: 1, timestamp: -1 }, name: 'idx_case_history_tenant_created_desc' },
  ],
};

async function ensureIndexes(db) {
  for (const [collectionName, indexes] of Object.entries(INDEX_DEFINITIONS)) {
    const collection = db.collection(collectionName);
    for (const spec of indexes) {
      const options = { name: spec.name };
      if (spec.partialFilterExpression) {
        options.partialFilterExpression = spec.partialFilterExpression;
      }
      await collection.createIndex(spec.key, options);
      console.log(`✓ ensured ${collectionName}.${spec.name}`);
    }
  }
}

async function dropIndexes(db) {
  for (const [collectionName, indexes] of Object.entries(INDEX_DEFINITIONS)) {
    const collection = db.collection(collectionName);
    const existing = await collection.indexes();
    const existingNames = new Set(existing.map((i) => i.name));

    for (const spec of indexes) {
      if (!existingNames.has(spec.name)) {
        console.log(`- skip ${collectionName}.${spec.name} (not present)`);
        continue;
      }
      await collection.dropIndex(spec.name);
      console.log(`✓ dropped ${collectionName}.${spec.name}`);
    }
  }
}

async function run() {
  await mongoose.connect(MONGO_URI);
  try {
    const db = mongoose.connection.db;
    if (direction === 'down') {
      await dropIndexes(db);
    } else {
      await ensureIndexes(db);
    }
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
