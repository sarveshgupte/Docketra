'use strict';

const mongoose = require('mongoose');

const COLLECTIONS_TO_SYNC = [
  'counters',
  'firms',
  'clients',
  'users',
  'teams',
  'categories',
  'tenantkeys',
  'tenantstorageconfigs',
  'onboarding_events',
  'auditlogs',
  'caseaudits',
];

async function syncCugToProd({ cugUri, prodUri, dryRun = true }) {
  if (!cugUri || !prodUri) {
    throw new Error('Both CUG_MONGO_URI and PROD_MONGO_URI environment variables or arguments are required.');
  }

  console.log('[DB-SYNC] Connecting to CUG...');
  const cugConn = await mongoose.createConnection(cugUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  console.log(`[DB-SYNC] Connected to CUG: ${cugConn.name}`);

  console.log('[DB-SYNC] Connecting to PROD...');
  const prodConn = await mongoose.createConnection(prodUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  console.log(`[DB-SYNC] Connected to PROD: ${prodConn.name}`);

  if (cugConn.name === prodConn.name) {
    throw new Error('Source and destination database names are identical. Aborting.');
  }

  const report = {};

  for (const colName of COLLECTIONS_TO_SYNC) {
    const cugCol = cugConn.collection(colName);
    const prodCol = prodConn.collection(colName);

    const cugDocs = await cugCol.find({}).toArray();
    const prodCountBefore = await prodCol.countDocuments();

    report[colName] = {
      sourceCount: cugDocs.length,
      prodCountBefore,
      copiedCount: 0,
      skippedCount: 0,
    };

    if (cugDocs.length === 0) continue;

    for (const doc of cugDocs) {
      const existing = await prodCol.findOne({ _id: doc._id });
      if (existing) {
        report[colName].skippedCount++;
        continue;
      }

      if (!dryRun) {
        await prodCol.insertOne(doc);
      }
      report[colName].copiedCount++;
    }
  }

  console.log('\n--- Sync Report ---');
  console.log(dryRun ? 'Mode: DRY-RUN (no changes made)' : 'Mode: LIVE SYNC COMPLETED');
  console.table(report);

  await cugConn.close();
  await prodConn.close();

  return report;
}

if (require.main === module) {
  const cugUri = process.env.CUG_MONGO_URI;
  const prodUri = process.env.PROD_MONGO_URI;
  const dryRun = !process.argv.includes('--execute');

  if (!cugUri || !prodUri) {
    console.error('Usage: CUG_MONGO_URI="<uri>" PROD_MONGO_URI="<uri>" node scripts/sync-cug-to-prod.js [--execute]');
    process.exit(1);
  }

  syncCugToProd({ cugUri, prodUri, dryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DB-SYNC] Error:', err);
      process.exit(1);
    });
}

module.exports = { syncCugToProd };
