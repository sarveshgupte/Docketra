/**
 * Backfill Script: Fix legacy admins missing firmId/defaultClientId
 *
 * Rules enforced:
 * - SUPER_ADMIN: firmId/defaultClientId optional
 * - Admin/Employee: firmId and defaultClientId required
 *
 * Behavior:
 * - Resolves firm from firmId or defaultClientId
 * - Ensures firm has a default client (creates if missing)
 * - Backfills missing firmId/defaultClientId for non-superadmin users
 * - Idempotent and safe to re-run
 *
 * Run manually: node src/scripts/fixAdminHierarchy.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const { ensureDefaultClientForFirm } = require('../services/defaultClient.service');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';

const timestamp = () => new Date().toISOString();

async function resolveFirm(admin) {
  if (admin.firmId) {
    return Firm.findById(admin.firmId);
  }

  if (admin.defaultClientId) {
    const client = await Client.findById(admin.defaultClientId);
    if (client?.firmId) {
      return Firm.findById(client.firmId);
    }
  }

  return null;
}

async function fixSingleAdmin(admin) {
  const firm = await resolveFirm(admin);
  if (!firm) {
    console.warn(`[MIGRATION] [${timestamp()}] Skipping ${admin.xID} - unable to resolve firm context`);
    return { fixed: false, reason: 'firm_unresolved' };
  }

  // Ensure firm has default client (creates if missing)
  if (!firm.defaultClientId) {
    await ensureDefaultClientForFirm(firm);
  }

  const updates = {};

  if (!admin.firmId) {
    updates.firmId = firm._id;
  }

  // Ensure we get the latest defaultClientId in case ensureDefaultClientForFirm just created it
  let reloadedFirm;
  if (admin.firmId) {
      reloadedFirm = await Firm.findById(admin.firmId);
  } else {
      reloadedFirm = await Firm.findById(updates.firmId);
  }

  let defaultClientId;
  if (reloadedFirm && reloadedFirm.defaultClientId) {
      defaultClientId = reloadedFirm.defaultClientId;
  } else if (firm.defaultClientId) {
      defaultClientId = firm.defaultClientId;
  }

  if (defaultClientId && (!admin.defaultClientId || admin.defaultClientId.toString() !== defaultClientId.toString())) {
      updates.defaultClientId = defaultClientId;
  }

  if (Object.keys(updates).length === 0) {
    return { fixed: false, reason: 'no_change' };
  }

  // Use collection.updateOne directly to completely bypass Mongoose schema layers and bugs in scripts updating invalid data
  await mongoose.connection.db.collection('users').updateOne({ _id: admin._id }, { $set: updates });

  console.log(
    `[MIGRATION] [${timestamp()}] Fixed ${admin.role} ${admin.xID} ` +
    `(firmId: ${updates.firmId ? 'set' : 'ok'}, defaultClientId: ${updates.defaultClientId ? 'set' : 'ok'})`
  );

  return { fixed: true, updates };
}

async function runAdminHierarchyBackfill(options = {}) {
  const { useExistingConnection = false } = options;

  if (!useExistingConnection) {
    console.log(`[MIGRATION] Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('[MIGRATION] Connected');
  }

  try {
    const candidates = await User.find({
      role: { $in: ['Admin', 'Employee'] },
      $or: [
        { firmId: { $exists: false } },
        { firmId: null },
        { defaultClientId: { $exists: false } },
        { defaultClientId: null },
      ],
    }).select('xID role firmId defaultClientId');

    if (candidates.length === 0) {
      console.log('[MIGRATION] No admins/users require backfill. Nothing to do.');
      return { processed: 0, fixed: 0 };
    }

    console.log(`[MIGRATION] Found ${candidates.length} admin/user record(s) to evaluate`);
    let fixed = 0;

    for (const admin of candidates) {
      const result = await fixSingleAdmin(admin);
      if (result.fixed) fixed += 1;
    }

    console.log(`[MIGRATION] Completed. Fixed ${fixed}/${candidates.length} record(s).`);
    return { processed: candidates.length, fixed };
  } finally {
    if (!useExistingConnection) {
      await mongoose.disconnect();
      console.log('[MIGRATION] Disconnected from MongoDB');
    }
  }
}

if (require.main === module) {
  runAdminHierarchyBackfill().catch((err) => {
    console.error('[MIGRATION] Failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runAdminHierarchyBackfill };
