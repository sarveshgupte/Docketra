/**
 * Migration Script: Setup Firm and Update User References
 * 
 * This script:
 * 1. Creates the default FIRM001 organization if it doesn't exist
 * 2. Updates all existing users to reference the Firm ObjectId instead of string
 * 3. Ensures data integrity during the firmId migration
 * 
 * Run with: node src/scripts/migrateToFirmModel.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const Client = require('../models/Client.model');
const Case = require('../models/Case.model');
const { ensureDefaultClientForFirm } = require('../services/defaultClient.service');
const log = require('../utils/log');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';
const DEFAULT_FIRM_ID = 'FIRM001';
const DEFAULT_FIRM_NAME = process.env.DEFAULT_FIRM_NAME || "Sarvesh's Org";

async function runMigration() {
  try {
    log.info('[MIGRATION] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log.info('[MIGRATION] Connected to MongoDB');

    // Step 1: Create or find default firm
    log.info('\n[MIGRATION] Step 1: Creating/Finding default firm...');
    let defaultFirm = await Firm.findOne({ firmId: DEFAULT_FIRM_ID });
    
    if (!defaultFirm) {
      log.info(`[MIGRATION] Creating default firm: ${DEFAULT_FIRM_ID} - ${DEFAULT_FIRM_NAME}`);
      defaultFirm = await Firm.create({
        firmId: DEFAULT_FIRM_ID,
        name: DEFAULT_FIRM_NAME,
        status: 'active',
      });
      log.info(`[MIGRATION] ✓ Default firm created: ${defaultFirm._id}`);
    } else {
      log.info(`[MIGRATION] ✓ Default firm already exists: ${defaultFirm._id}`);
    }

    // Ensure default client exists for the firm
    if (!defaultFirm.defaultClientId) {
      await ensureDefaultClientForFirm(defaultFirm);
    }

    // Step 2: Update users - migrate string firmId to ObjectId reference
    log.info('\n[MIGRATION] Step 2: Updating users...');
    const usersToUpdate = await User.find({ 
      $or: [
        { firmId: DEFAULT_FIRM_ID }, // String format
        { firmId: { $type: 'string' } }, // Any string firmId
      ]
    });
    
    log.info(`[MIGRATION] Found ${usersToUpdate.length} users to update`);
    
    let updatedUsers = 0;
    if (usersToUpdate.length > 0) {
      try {
        const userIds = usersToUpdate.map(user => user._id);

        // Update firmId using updateMany to bypass immutability and reduce DB calls
        await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { firmId: defaultFirm._id } }
        );
        
        // Add restrictedClientIds if it doesn't exist
        await User.updateMany(
          { _id: { $in: userIds }, restrictedClientIds: { $exists: false } },
          { $set: { restrictedClientIds: [] } }
        );
        
        updatedUsers = usersToUpdate.length;
        for (const user of usersToUpdate) {
          log.info(`[MIGRATION]   ✓ Updated user: ${user.xID}`);
        }
      } catch (err) {
        log.error(`[MIGRATION]   ✗ Failed to perform bulk update on users:`, err.message);
      }
    }
    
    log.info(`[MIGRATION] ✓ Updated ${updatedUsers} users`);

    // Step 3: Verify migration
    log.info('\n[MIGRATION] Step 3: Verifying migration...');
    const verifyUsers = await User.find({ firmId: defaultFirm._id }).limit(5);
    log.info(`[MIGRATION] Sample users with new firmId ObjectId:`);
    verifyUsers.forEach(user => {
      log.info(`[MIGRATION]   - ${user.xID}: firmId type = ${typeof user.firmId}, value = ${user.firmId}`);
    });

    // Count users with string firmId (should be 0)
    const remainingStringFirmIds = await User.countDocuments({ 
      firmId: { $type: 'string' } 
    });
    
    if (remainingStringFirmIds > 0) {
      log.warn(`[MIGRATION] ⚠️  Warning: ${remainingStringFirmIds} users still have string firmId`);
    } else {
      log.info('[MIGRATION] ✓ All users have ObjectId firmId references');
    }

    log.info('\n[MIGRATION] ✓ Migration completed successfully');
    log.info('[MIGRATION] Summary:');
    log.info(`[MIGRATION]   - Firm created/found: ${defaultFirm.firmId} (${defaultFirm.name})`);
    log.info(`[MIGRATION]   - Users updated: ${updatedUsers}`);
    log.info(`[MIGRATION]   - Remaining string firmIds: ${remainingStringFirmIds}`);

  } catch (error) {
    log.error('[MIGRATION] ✗ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    log.info('\n[MIGRATION] Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      log.info('[MIGRATION] Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      log.error('[MIGRATION] Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
