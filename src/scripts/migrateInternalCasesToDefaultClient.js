/**
 * Migration: backfill internal dockets without clientId to firm default client.
 *
 * Run:
 *   node src/scripts/migrateInternalCasesToDefaultClient.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const log = require('../utils/log');

const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const Case = require('../models/Case.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';

async function runMigration() {
  await mongoose.connect(MONGODB_URI);
  log.info('[MIGRATION] Connected to MongoDB');

  const firms = await Firm.find({}, { _id: 1, firmId: 1, defaultClientId: 1 }).lean();
  let totalUpdated = 0;

  for (const firm of firms) {
    let defaultClient = null;

    if (firm.defaultClientId) {
      defaultClient = await Client.findOne({ _id: firm.defaultClientId, firmId: firm._id }, { clientId: 1 }).lean();
    }

    if (!defaultClient) {
      defaultClient = await Client.findOne(
        {
          firmId: firm._id,
          $or: [{ isDefaultClient: true }, { isSystemClient: true }, { isInternal: true }, { clientId: 'C000001' }],
        },
        { clientId: 1 }
      ).lean();
    }

    if (!defaultClient?.clientId) {
      log.warn(`[MIGRATION] Skipping firm ${firm.firmId || firm._id}: default client not found`);
      continue;
    }

    const updateResult = await Case.updateMany(
      {
        firmId: firm._id,
        isInternal: true,
        $or: [{ clientId: { $exists: false } }, { clientId: null }, { clientId: '' }],
      },
      { $set: { clientId: defaultClient.clientId } }
    );

    if (updateResult.modifiedCount > 0) {
      log.info(`[MIGRATION] Firm ${firm.firmId || firm._id}: updated ${updateResult.modifiedCount} case(s)`);
      totalUpdated += updateResult.modifiedCount;
    }
  }

  log.info(`[MIGRATION] Completed. Total updated cases: ${totalUpdated}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  runMigration().catch((error) => {
    log.error('[MIGRATION] Failed:', error);
    mongoose.disconnect().catch(() => null);
    process.exit(1);
  });
}

module.exports = { runMigration };
