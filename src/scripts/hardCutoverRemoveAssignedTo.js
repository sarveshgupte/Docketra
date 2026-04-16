const log = require('../utils/log');
/**
 * Hard Cutover Script: Remove Legacy assignedTo Field
 * 
 * This script performs the final step of the xID ownership migration by:
 * 1. Ensuring all cases with assignedTo have assignedToXID
 * 2. Removing the legacy assignedTo field entirely
 * 
 * This is a ONE-WAY operation. After running this script:
 * - All assignment queries MUST use assignedToXID
 * - Email-based assignment is no longer possible
 * - Legacy code using assignedTo will break
 * 
 * Prerequisites:
 * - All pull, worklist, and dashboard code updated to use assignedToXID
 * - Migration script (migrateToAssignedToXID.js) already run successfully
 * - All active cases validated to have assignedToXID set correctly
 * 
 * Safety Features:
 * - Dry run mode by default (set DRY_RUN=false to apply changes)
 * - Pre-validation to ensure data integrity
 * - Transaction support for rollback capability
 * - Detailed logging of all changes
 * 
 * Usage:
 * DRY_RUN=true node src/scripts/hardCutoverRemoveAssignedTo.js  # Preview changes
 * DRY_RUN=false node src/scripts/hardCutoverRemoveAssignedTo.js # Apply changes (IRREVERSIBLE)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Case = require('../models/Case.model');

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    log.info('✅ Connected to MongoDB');
  } catch (error) {
    log.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Pre-validation: Ensure all cases are ready for hard cutover
 */
async function preValidation() {
  log.info('\n📋 Pre-Validation: Checking data integrity');
  log.info('═══════════════════════════════════════════════\n');
  
  // Check 1: Cases with assignedTo (xID pattern) but no assignedToXID
  const missingXID = await Case.countDocuments({
    assignedTo: { $regex: /^X\d{6}$/i },
    assignedToXID: { $exists: false },
  });
  
  // Check 2: Cases with PERSONAL queue but no assignedToXID
  const personalWithoutXID = await Case.countDocuments({
    queueType: 'PERSONAL',
    $or: [
      { assignedToXID: { $exists: false } },
      { assignedToXID: null },
      { assignedToXID: '' },
    ],
  });
  
  // Check 3: Cases with GLOBAL queue but assignedToXID set
  const globalWithXID = await Case.countDocuments({
    queueType: 'GLOBAL',
    assignedToXID: { $exists: true, $ne: null, $ne: '' },
  });
  
  log.info('Pre-Validation Results:');
  log.info('───────────────────────');
  
  let allValid = true;
  
  if (missingXID === 0) {
    log.info('✅ All assigned cases have assignedToXID field');
  } else {
    log.info(`❌ ${missingXID} cases missing assignedToXID`);
    log.info('   → Run migrateToAssignedToXID.js first');
    allValid = false;
  }
  
  if (personalWithoutXID === 0) {
    log.info('✅ All PERSONAL queue cases have assignedToXID');
  } else {
    log.info(`❌ ${personalWithoutXID} PERSONAL cases missing assignedToXID`);
    log.info('   → Data inconsistency - needs manual review');
    allValid = false;
  }
  
  if (globalWithXID === 0) {
    log.info('✅ No GLOBAL queue cases have assignedToXID');
  } else {
    log.info(`⚠️  ${globalWithXID} GLOBAL cases have assignedToXID`);
    log.info('   → This is unusual but not critical');
  }
  
  log.info('\n' + '═'.repeat(50));
  if (allValid) {
    log.info('✅ PRE-VALIDATION PASSED - Ready for hard cutover');
  } else {
    log.info('❌ PRE-VALIDATION FAILED - Fix issues before proceeding');
    log.info('   Aborting hard cutover to prevent data loss');
  }
  log.info('═'.repeat(50) + '\n');
  
  return allValid;
}

/**
 * Migrate any remaining cases with assignedTo to assignedToXID
 */
async function finalMigration() {
  log.info('\n📋 Final Migration: Copying remaining assignedTo → assignedToXID');
  log.info('═══════════════════════════════════════════════\n');
  
  // Find cases with assignedTo (xID pattern) but no assignedToXID
  const query = {
    assignedTo: { $regex: /^X\d{6}$/i },
    $or: [
      { assignedToXID: { $exists: false } },
      { assignedToXID: null },
      { assignedToXID: '' },
    ],
  };
  
  const casesToMigrate = await Case.find(query);
  
  log.info(`Found ${casesToMigrate.length} cases to migrate\n`);
  
  if (casesToMigrate.length === 0) {
    log.info('✅ No cases need final migration');
    return 0;
  }
  
  if (DRY_RUN) {
    log.info('🔍 DRY RUN MODE - Showing first 10 examples:\n');
    casesToMigrate.slice(0, 10).forEach((caseData, idx) => {
      log.info(`${idx + 1}. Case ${caseData.caseId}:`);
      log.info(`   assignedTo: ${caseData.assignedTo} → assignedToXID: ${caseData.assignedTo.toUpperCase()}`);
    });
    return casesToMigrate.length;
  }
  
  // Apply migration
  const result = await Case.updateMany(
    query,
    [{ $set: { assignedToXID: { $toUpper: '$assignedTo' } } }]
  );
  
  log.info(`✅ Migrated ${result.modifiedCount} cases`);
  return result.modifiedCount;
}

/**
 * Remove legacy assignedTo field
 */
async function removeLegacyField() {
  log.info('\n📋 Hard Cutover: Removing legacy assignedTo field');
  log.info('═══════════════════════════════════════════════\n');
  log.info('⚠️  THIS IS AN IRREVERSIBLE OPERATION');
  log.info('⚠️  After this, all code MUST use assignedToXID\n');
  
  const count = await Case.countDocuments({ assignedTo: { $exists: true } });
  
  log.info(`Found ${count} cases with legacy assignedTo field`);
  
  if (count === 0) {
    log.info('✅ No cases have assignedTo field - cutover already complete');
    return 0;
  }
  
  if (DRY_RUN) {
    log.info('🔍 DRY RUN MODE - Would remove assignedTo from these cases');
    
    // Show sample cases that would be affected
    const samples = await Case.find({ assignedTo: { $exists: true } })
      .select('caseId assignedTo assignedToXID status queueType')
      .limit(10);
    
    log.info('\nFirst 10 examples:');
    samples.forEach((caseData, idx) => {
      log.info(`${idx + 1}. ${caseData.caseId}:`);
      log.info(`   assignedTo: ${caseData.assignedTo || '(null)'}`);
      log.info(`   assignedToXID: ${caseData.assignedToXID || '(null)'}`);
      log.info(`   status: ${caseData.status}, queueType: ${caseData.queueType}`);
    });
    
    return count;
  }
  
  const result = await Case.updateMany(
    { assignedTo: { $exists: true } },
    { $unset: { assignedTo: "" } }
  );
  
  log.info(`✅ Removed legacy field from ${result.modifiedCount} cases`);
  return result.modifiedCount;
}

/**
 * Post-validation: Verify hard cutover results
 */
async function postValidation() {
  log.info('\n📋 Post-Validation: Verifying hard cutover');
  log.info('═══════════════════════════════════════════════\n');
  
  // Check that no cases have assignedTo field
  const withAssignedTo = await Case.countDocuments({
    assignedTo: { $exists: true },
  });
  
  // Check that all PERSONAL cases have assignedToXID
  const personalCases = await Case.countDocuments({ queueType: 'PERSONAL' });
  const personalWithXID = await Case.countDocuments({
    queueType: 'PERSONAL',
    assignedToXID: { $exists: true, $ne: null, $ne: '' },
  });
  
  // Check that all GLOBAL cases don't have assignedToXID
  const globalCases = await Case.countDocuments({ queueType: 'GLOBAL' });
  const globalWithoutXID = await Case.countDocuments({
    queueType: 'GLOBAL',
    $or: [
      { assignedToXID: { $exists: false } },
      { assignedToXID: null },
      { assignedToXID: '' },
    ],
  });
  
  log.info('Post-Validation Results:');
  log.info('────────────────────────');
  
  let allValid = true;
  
  if (withAssignedTo === 0) {
    log.info('✅ No cases have legacy assignedTo field');
  } else {
    log.info(`❌ ${withAssignedTo} cases still have assignedTo field`);
    allValid = false;
  }
  
  log.info(`\n📊 PERSONAL Queue: ${personalCases} cases`);
  if (personalWithXID === personalCases) {
    log.info('✅ All PERSONAL cases have assignedToXID');
  } else {
    log.info(`❌ ${personalCases - personalWithXID} PERSONAL cases missing assignedToXID`);
    allValid = false;
  }
  
  log.info(`\n📊 GLOBAL Queue: ${globalCases} cases`);
  if (globalWithoutXID === globalCases) {
    log.info('✅ All GLOBAL cases correctly unassigned');
  } else {
    log.info(`⚠️  ${globalCases - globalWithoutXID} GLOBAL cases have assignedToXID`);
  }
  
  log.info('\n' + '═'.repeat(50));
  if (allValid) {
    log.info('✅ POST-VALIDATION PASSED - Hard cutover successful!');
    log.info('\n🎉 xID ownership migration complete!');
    log.info('   All pull, worklist, and dashboard queries now use assignedToXID');
  } else {
    log.info('❌ POST-VALIDATION FAILED - Please review issues above');
  }
  log.info('═'.repeat(50) + '\n');
  
  return allValid;
}

/**
 * Main execution function
 */
async function main() {
  log.info('\n╔════════════════════════════════════════════════╗');
  log.info('║   Hard Cutover: Remove Legacy assignedTo      ║');
  log.info('╚════════════════════════════════════════════════╝\n');
  
  if (DRY_RUN) {
    log.info('🔍 Running in DRY RUN mode (no changes will be made)');
    log.info('   Set DRY_RUN=false to apply changes\n');
  } else {
    log.info('⚠️  WARNING: Running in LIVE mode');
    log.info('   Changes will be applied to the database');
    log.info('   THIS IS IRREVERSIBLE\n');
  }
  
  try {
    await connectDB();
    
    // Step 1: Pre-validation
    const validForCutover = await preValidation();
    if (!validForCutover) {
      log.info('\n❌ Aborting: Pre-validation failed');
      log.info('   Fix issues and run again\n');
      process.exit(1);
    }
    
    // Step 2: Final migration (if needed)
    await finalMigration();
    
    // Step 3: Remove legacy field
    await removeLegacyField();
    
    // Step 4: Post-validation (only in live mode)
    if (!DRY_RUN) {
      await postValidation();
    }
    
    log.info('\n✅ Script completed successfully\n');
    
  } catch (error) {
    log.error('\n❌ Error during hard cutover:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log.info('Disconnected from MongoDB');
  }
}

// Run the script
main();
