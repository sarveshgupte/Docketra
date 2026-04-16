/**
 * Data Migration Script: Convert assignedTo from email to xID
 * PR #42: Standardize case assignment to use xID
 * 
 * This script:
 * 1. Finds all cases where assignedTo contains an email (has @ symbol)
 * 2. Resolves email → user → xID
 * 3. Updates assignedTo field to xID
 * 4. Creates audit log entries for the migration
 * 
 * Usage:
 *   node src/scripts/migrateAssignedToXID.js
 * 
 * This is a one-time migration and is idempotent (safe to run multiple times)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const User = require('../models/User.model');
const CaseHistory = require('../models/CaseHistory.model');
const log = require('../utils/log');

async function migrateAssignedToXID() {
  try {
    log.info('🔄 Starting migration: assignedTo email → xID');
    log.info('================================================\n');
    
    // Connect to database
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caseflow';
    await mongoose.connect(mongoURI);
    log.info('✅ Connected to MongoDB\n');
    
    // Find all cases with assignedTo containing @ (email format)
    const casesWithEmail = await Case.find({
      assignedTo: { $regex: '@', $options: 'i' }
    }).lean();
    
    log.info(`📊 Found ${casesWithEmail.length} cases with email in assignedTo field\n`);
    
    if (casesWithEmail.length === 0) {
      log.info('✅ No migration needed - all cases already use xID\n');
      await mongoose.disconnect();
      return;
    }
    
    let successCount = 0;
    let failedCount = 0;
    const failedCases = [];
    
    const uniqueEmails = [...new Set(casesWithEmail.map(c => c.assignedTo.trim().toLowerCase()))];

    // Find all relevant users at once
    const users = await User.find({ email: { $in: uniqueEmails }, status: { $ne: 'deleted' } }).lean();

    // Build an email-to-user map
    const userMap = new Map();
    for (const user of users) {
      userMap.set(user.email.toLowerCase(), user);
    }

    const bulkCaseUpdates = [];
    const bulkHistoryInserts = [];

    // Process each case in memory
    for (const caseData of casesWithEmail) {
      const email = caseData.assignedTo.trim().toLowerCase();
      
      try {
        const user = userMap.get(email);
        
        if (!user) {
          log.info(`⚠️  Case ${caseData.caseId}: User not found for email ${email}`);
          failedCount++;
          failedCases.push({
            caseId: caseData.caseId,
            email: email,
            reason: 'User not found',
          });
          continue;
        }
        
        // Prepare bulk update for Case
        bulkCaseUpdates.push({
          updateOne: {
            filter: { _id: caseData._id },
            update: { $set: { assignedTo: user.xID } }
          }
        });
        
        // Prepare audit log entry for CaseHistory
        bulkHistoryInserts.push({
          caseId: caseData.caseId,
          actionType: 'MIGRATION_EMAIL_TO_XID',
          description: `Migration: assignedTo updated from ${email} to ${user.xID}`,
          performedBy: 'system',
        });
        
        log.info(`✅ Case ${caseData.caseId}: ${email} → ${user.xID}`);
        successCount++;
        
      } catch (error) {
        log.error(`❌ Case ${caseData.caseId}: Migration failed - ${error.message}`);
        failedCount++;
        failedCases.push({
          caseId: caseData.caseId,
          email: email,
          reason: error.message,
        });
      }
    }

    if (bulkCaseUpdates.length > 0) {
      try {
        log.info(`\n💾 Executing ${bulkCaseUpdates.length} database updates...`);
        await Case.bulkWrite(bulkCaseUpdates);
        await CaseHistory.insertMany(bulkHistoryInserts);
        log.info('✅ Database updates successful\n');
      } catch (error) {
        log.error('❌ Database update failed:', error.message);
        throw error;
      }
    }
    
    // Print summary
    log.info('\n================================================');
    log.info('📊 Migration Summary:');
    log.info(`   Total cases processed: ${casesWithEmail.length}`);
    log.info(`   ✅ Successful: ${successCount}`);
    log.info(`   ❌ Failed: ${failedCount}`);
    
    if (failedCases.length > 0) {
      log.info('\n⚠️  Failed cases:');
      failedCases.forEach(fc => {
        log.info(`   - ${fc.caseId} (${fc.email}): ${fc.reason}`);
      });
    }
    
    log.info('\n✅ Migration complete!\n');
    
    // Disconnect from database
    await mongoose.disconnect();
    log.info('✅ Disconnected from MongoDB');
    
  } catch (error) {
    log.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateAssignedToXID();
