/**
 * Backfill Script: Ensure every firm has a default internal client
 *
 * For each firm missing defaultClientId:
 * 1. Create an internal/system client representing the firm itself
 * 2. Link firm.defaultClientId to the created client
 * 3. Assign defaultClientId to any users under the firm missing it
 *
 * Run with: node src/scripts/backfillDefaultClients.js
 */

const mongoose = require('mongoose');
const log = require('../utils/log');
require('dotenv').config();

const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const { generateNextClientId } = require('../services/clientIdGenerator');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';

async function backfillFirm(firm) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const clientId = await generateNextClientId(firm._id, session);

    const internalClient = new Client({
      clientId,
      businessName: firm.name,
      businessAddress: null,
      primaryContactNumber: '0000000000',
      businessEmail: `${firm.firmId.toLowerCase()}@system.local`,
      firmId: firm._id,
      isSystemClient: true,
      isInternal: true,
      createdBySystem: true,
      status: 'ACTIVE',
      isActive: true,
      createdByXid: 'SUPERADMIN',
      createdBy: process.env.SUPERADMIN_EMAIL, // required by env validation in application runtime
    });

    await internalClient.save({ session });
    log.info(`[MIGRATION] Internal client created for firm ${firm.firmId} (${internalClient.clientId})`);

    firm.defaultClientId = internalClient._id;
    await firm.save({ session });
    log.info(`[MIGRATION] defaultClientId linked for firm ${firm.firmId}`);

    const updatedUsers = await User.updateMany(
      { firmId: firm._id, $or: [{ defaultClientId: { $exists: false } }, { defaultClientId: null }] },
      { $set: { defaultClientId: internalClient._id } },
      { session }
    );
    if (updatedUsers.modifiedCount > 0) {
      log.info(`[MIGRATION] Updated ${updatedUsers.modifiedCount} user(s) for firm ${firm.firmId}`);
    }

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    log.error(`[MIGRATION] Failed to backfill firm ${firm.firmId}:`, err.message);
    throw err;
  }
}

async function runBackfill() {
  try {
    log.info('[MIGRATION] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log.info('[MIGRATION] Connected to MongoDB');

    const firmsToBackfill = await Firm.find({
      $or: [{ defaultClientId: { $exists: false } }, { defaultClientId: null }],
    });

    if (firmsToBackfill.length === 0) {
      log.info('[MIGRATION] All firms already have defaultClientId. No action needed.');
      return;
    }

    log.info(`[MIGRATION] Found ${firmsToBackfill.length} firm(s) to backfill`);

    for (const firm of firmsToBackfill) {
      await backfillFirm(firm);
    }

    log.info('[MIGRATION] Backfill completed successfully');
  } catch (error) {
    log.error('[MIGRATION] Backfill failed:', error.message);
  } finally {
    await mongoose.disconnect();
    log.info('[MIGRATION] Disconnected from MongoDB');
  }
}

if (require.main === module) {
  runBackfill();
}

module.exports = { runBackfill };
