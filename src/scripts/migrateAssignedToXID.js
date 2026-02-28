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

async function migrateAssignedToXID() {
  try {
    console.log('🔄 Starting migration: assignedTo email → xID');
    console.log('================================================\n');
    
    // Connect to database
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caseflow';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all cases with assignedTo containing @ (email format)
    const casesWithEmail = await Case.find({
      assignedTo: { $regex: '@', $options: 'i' }
    }).lean();
    
    console.log(`📊 Found ${casesWithEmail.length} cases with email in assignedTo field\n`);
    
    if (casesWithEmail.length === 0) {
      console.log('✅ No migration needed - all cases already use xID\n');
      await mongoose.disconnect();
      return;
    }
    
    let successCount = 0;
    let failedCount = 0;
    const failedCases = [];
    
    // Process each case
    for (const caseData of casesWithEmail) {
      const email = caseData.assignedTo.trim().toLowerCase();
      
      try {
        // Find user by email
        const user = await User.findOne({ email, status: { $ne: 'deleted' } }).lean();
        
        if (!user) {
          console.log(`⚠️  Case ${caseData.caseId}: User not found for email ${email}`);
          failedCount++;
          failedCases.push({
            caseId: caseData.caseId,
            email: email,
            reason: 'User not found',
          });
          continue;
        }
        
        // Update case with xID
        await Case.updateOne(
          { _id: caseData._id },
          { $set: { assignedTo: user.xID } }
        );
        
        // Create audit log entry
        await CaseHistory.create({
          caseId: caseData.caseId,
          actionType: 'MIGRATION_EMAIL_TO_XID',
          description: `Migration: assignedTo updated from ${email} to ${user.xID}`,
          performedBy: 'system',
        });
        
        console.log(`✅ Case ${caseData.caseId}: ${email} → ${user.xID}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Case ${caseData.caseId}: Migration failed - ${error.message}`);
        failedCount++;
        failedCases.push({
          caseId: caseData.caseId,
          email: email,
          reason: error.message,
        });
      }
    }
    
    // Print summary
    console.log('\n================================================');
    console.log('📊 Migration Summary:');
    console.log(`   Total cases processed: ${casesWithEmail.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    
    if (failedCases.length > 0) {
      console.log('\n⚠️  Failed cases:');
      failedCases.forEach(fc => {
        console.log(`   - ${fc.caseId} (${fc.email}): ${fc.reason}`);
      });
    }
    
    console.log('\n✅ Migration complete!\n');
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateAssignedToXID();
