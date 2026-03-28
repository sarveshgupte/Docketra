/**
 * Migration safety script for users missing firmId.
 *
 * Modes:
 * - reonboard (default): force re-onboarding for tenant users by setting isOnboarded=false.
 * - fallback: assign users to a fallback firm via --fallbackFirmId=<ObjectId>.
 *
 * Usage:
 *   node src/scripts/fixUsersWithoutFirmId.js
 *   node src/scripts/fixUsersWithoutFirmId.js --mode=fallback --fallbackFirmId=<firmObjectId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Firm = require('../models/Firm.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';
const args = process.argv.slice(2);
const modeArg = args.find((arg) => arg.startsWith('--mode=')) || '--mode=reonboard';
const fallbackArg = args.find((arg) => arg.startsWith('--fallbackFirmId='));
const mode = modeArg.split('=')[1];
const fallbackFirmId = fallbackArg ? fallbackArg.split('=')[1] : null;

async function runFixUsersWithoutFirmId() {
  console.log(`[MIGRATION] Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('[MIGRATION] Connected');

  try {
    const query = {
      role: { $ne: 'SUPER_ADMIN' },
      status: { $ne: 'deleted' },
      $or: [{ firmId: { $exists: false } }, { firmId: null }],
    };
    const users = await User.find(query).select('_id xID email role firmId isOnboarded');

    if (users.length === 0) {
      console.log('[MIGRATION] No users with missing firmId found.');
      return { scanned: 0, updated: 0, mode };
    }

    let resolvedFallbackFirmId = null;
    if (mode === 'fallback') {
      if (!fallbackFirmId) {
        throw new Error('fallback mode requires --fallbackFirmId=<ObjectId>');
      }
      const fallbackFirm = await Firm.findById(fallbackFirmId).select('_id firmId name');
      if (!fallbackFirm) {
        throw new Error(`fallback firm not found: ${fallbackFirmId}`);
      }
      resolvedFallbackFirmId = fallbackFirm._id;
      console.log(`[MIGRATION] Using fallback firm ${fallbackFirm.firmId} (${fallbackFirm.name})`);
    }

    let updated = 0;
    for (const user of users) {
      if (mode === 'fallback') {
        user.firmId = resolvedFallbackFirmId;
        user.isOnboarded = true;
      } else {
        user.isOnboarded = false;
      }
      await user.save();
      updated += 1;
      console.log(`[MIGRATION] Updated user ${user.xID || user.email} (mode=${mode})`);
    }

    console.log(`[MIGRATION] Completed. scanned=${users.length}, updated=${updated}, mode=${mode}`);
    return { scanned: users.length, updated, mode };
  } finally {
    await mongoose.disconnect();
    console.log('[MIGRATION] Disconnected from MongoDB');
  }
}

if (require.main === module) {
  runFixUsersWithoutFirmId().catch((error) => {
    console.error('[MIGRATION] Failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runFixUsersWithoutFirmId };

