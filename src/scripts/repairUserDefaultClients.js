/**
 * Backfill Script: Repair user.defaultClientId for all tenant users.
 *
 * Invariant enforced per user:
 * - user.defaultClientId exists
 * - client.isDefaultClient === true
 * - client.firmId === user.firmId
 *
 * Run manually: node src/scripts/repairUserDefaultClients.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Client = require('../models/Client.model');
const log = require('../utils/log');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';

const timestamp = () => new Date().toISOString();

async function runRepairUserDefaultClients({ useExistingConnection = false } = {}) {
  if (!useExistingConnection) {
    log.info(`[MIGRATION] Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    log.info('[MIGRATION] Connected');
  }

  try {
    const users = await User.find({
      role: { $ne: 'SUPER_ADMIN' },
      firmId: { $ne: null },
      status: { $ne: 'deleted' },
    }).select('_id xID role firmId defaultClientId');

    let scanned = 0;
    let repaired = 0;
    let skipped = 0;

    for (const user of users) {
      scanned += 1;

      const defaultClient = await Client.findOne({
        firmId: user.firmId,
        isDefaultClient: true,
      }).select('_id firmId isDefaultClient').lean();

      if (!defaultClient) {
        skipped += 1;
        log.warn(`[MIGRATION] [${timestamp()}] Skipping ${user.xID} - no default client found for firm ${String(user.firmId)}`);
        continue;
      }

      const alreadyValid = (
        user.defaultClientId
        && String(user.defaultClientId) === String(defaultClient._id)
      );

      if (alreadyValid) {
        continue;
      }

      user.defaultClientId = defaultClient._id;
      await user.save();
      repaired += 1;

      log.info(
        `[MIGRATION] [${timestamp()}] Repaired user ${user.xID} ` +
        `(firmId=${String(user.firmId)}, defaultClientId=${String(defaultClient._id)})`
      );
    }

    log.info(`[MIGRATION] Completed. scanned=${scanned}, repaired=${repaired}, skipped=${skipped}`);
    return { scanned, repaired, skipped };
  } finally {
    if (!useExistingConnection) {
      await mongoose.disconnect();
      log.info('[MIGRATION] Disconnected from MongoDB');
    }
  }
}

if (require.main === module) {
  runRepairUserDefaultClients().catch((error) => {
    log.error('[MIGRATION] Failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runRepairUserDefaultClients };
