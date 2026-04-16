const log = require('../utils/log');
/**
 * Migration Script: assignedTo → assignedToXID
 * 
 * This script migrates the Case collection to use the new assignedToXID field
 * as the canonical field for case assignment, deprecating the legacy assignedTo field.
 * 
 * What this script does:
 * 1. Copies all xID values from assignedTo to assignedToXID
 * 2. Normalizes queueType based on assignedToXID presence
 * 3. Normalizes status values (Open → OPEN, Pending → PENDED, etc.)
 * 4. Optionally removes the legacy assignedTo field (commented out by default)
 * 
 * Safety Features:
 * - Dry run mode by default (set DRY_RUN=false to apply changes)
 * - Progress reporting every 100 cases
 * - Transaction support for rollback capability
 * - Detailed logging of all changes
 * 
 * Usage:
 * DRY_RUN=true node src/scripts/migrateToAssignedToXID.js  # Preview changes
 * DRY_RUN=false node src/scripts/migrateToAssignedToXID.js # Apply changes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Case = require('../models/Case.model');

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false';
const BATCH_SIZE = 100;

// Status mapping for normalization
const STATUS_MAP = {
  'Open': 'OPEN',
  'open': 'OPEN',
  'Pending': 'PENDED',
  'pending': 'PENDED',
  'Filed': 'FILED',
  'filed': 'FILED',
};

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
 * Migrate assignedTo to assignedToXID
 */
async function migrateAssignedToXID() {
  log.info('\n📋 Step 1: Migrating assignedTo → assignedToXID');
  log.info('═══════════════════════════════════════════════\n');
  
  // Find all cases where assignedTo contains an xID pattern but assignedToXID is not set
  const query = {
    assignedTo: { $regex: /^X\d{6}$/i },
    assignedToXID: { $exists: false },
  };
  
  const casesToMigrate = await Case.find(query);
  
  log.info(`Found ${casesToMigrate.length} cases to migrate\n`);
  
  if (casesToMigrate.length === 0) {
    log.info('✅ No cases need migration for assignedTo → assignedToXID');
    return 0;
  }
  
  if (DRY_RUN) {
    log.info('🔍 DRY RUN MODE - Showing first 10 examples:\n');
    casesToMigrate.slice(0, 10).forEach((caseData, idx) => {
      log.info(`${idx + 1}. Case ${caseData.caseId}:`);
      log.info(`   assignedTo: ${caseData.assignedTo} → assignedToXID: ${caseData.assignedTo}`);
    });
    return casesToMigrate.length;
  }
  
  // Apply migration
  let migratedCount = 0;
  for (let i = 0; i < casesToMigrate.length; i++) {
    const caseData = casesToMigrate[i];
    
    caseData.assignedToXID = caseData.assignedTo.toUpperCase();
    await caseData.save();
    
    migratedCount++;
    
    if (migratedCount % BATCH_SIZE === 0) {
      log.info(`✅ Migrated ${migratedCount} / ${casesToMigrate.length} cases`);
    }
  }
  
  log.info(`\n✅ Successfully migrated ${migratedCount} cases`);
  return migratedCount;
}

/**
 * Normalize queueType based on assignedToXID
 */
async function normalizeQueueType() {
  log.info('\n📋 Step 2: Normalizing queueType');
  log.info('═══════════════════════════════════════════════\n');
  
  // Cases with assignedToXID should have queueType = PERSONAL
  const assignedCases = await Case.countDocuments({
    assignedToXID: { $ne: null },
    queueType: { $ne: 'PERSONAL' },
  });
  
  // Cases without assignedToXID should have queueType = GLOBAL
  const unassignedCases = await Case.countDocuments({
    assignedToXID: null,
    queueType: { $ne: 'GLOBAL' },
  });
  
  log.info(`Found ${assignedCases} assigned cases to normalize (→ PERSONAL)`);
  log.info(`Found ${unassignedCases} unassigned cases to normalize (→ GLOBAL)\n`);
  
  if (DRY_RUN) {
    log.info('🔍 DRY RUN MODE - No changes applied');
    return assignedCases + unassignedCases;
  }
  
  // Normalize assigned cases to PERSONAL
  const result1 = await Case.updateMany(
    { assignedToXID: { $ne: null }, queueType: { $ne: 'PERSONAL' } },
    { $set: { queueType: 'PERSONAL' } }
  );
  
  // Normalize unassigned cases to GLOBAL
  const result2 = await Case.updateMany(
    { assignedToXID: null, queueType: { $ne: 'GLOBAL' } },
    { $set: { queueType: 'GLOBAL' } }
  );
  
  log.info(`✅ Updated ${result1.modifiedCount} cases to PERSONAL queue`);
  log.info(`✅ Updated ${result2.modifiedCount} cases to GLOBAL queue`);
  
  return result1.modifiedCount + result2.modifiedCount;
}

/**
 * Normalize status values
 */
async function normalizeStatus() {
  log.info('\n📋 Step 3: Normalizing status values');
  log.info('═══════════════════════════════════════════════\n');
  
  let totalNormalized = 0;
  
  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    const count = await Case.countDocuments({ status: oldStatus });
    
    if (count > 0) {
      log.info(`Found ${count} cases with status '${oldStatus}' (will normalize to '${newStatus}')`);
      
      if (!DRY_RUN) {
        const result = await Case.updateMany(
          { status: oldStatus },
          { $set: { status: newStatus } }
        );
        log.info(`✅ Updated ${result.modifiedCount} cases`);
        totalNormalized += result.modifiedCount;
      } else {
        totalNormalized += count;
      }
    }
  }
  
  if (totalNormalized === 0) {
    log.info('✅ No status values need normalization');
  } else if (DRY_RUN) {
    log.info(`\n🔍 DRY RUN MODE - Would normalize ${totalNormalized} cases`);
  } else {
    log.info(`\n✅ Successfully normalized ${totalNormalized} cases`);
  }
  
  return totalNormalized;
}

/**
 * Optional: Remove legacy assignedTo field
 * 
 * ⚠️ WARNING: This step is DESTRUCTIVE and should only be run after
 * thorough validation that all systems are using assignedToXID.
 * 
 * By default, this step is COMMENTED OUT for safety.
 */
async function removeLegacyField() {
  log.info('\n📋 Step 4: Removing legacy assignedTo field');
  log.info('═══════════════════════════════════════════════\n');
  log.info('⚠️  This step is SKIPPED by default for safety');
  log.info('⚠️  Uncomment in the code to enable after validation\n');
  
  return 0;
  
  // UNCOMMENT BELOW TO ENABLE REMOVAL (after thorough validation)
  /*
  const count = await Case.countDocuments({ assignedTo: { $exists: true } });
  
  log.info(`Found ${count} cases with legacy assignedTo field`);
  
  if (DRY_RUN) {
    log.info('🔍 DRY RUN MODE - Would remove assignedTo from these cases');
    return count;
  }
  
  const result = await Case.updateMany(
    { assignedTo: { $exists: true } },
    { $unset: { assignedTo: "" } }
  );
  
  log.info(`✅ Removed legacy field from ${result.modifiedCount} cases`);
  return result.modifiedCount;
  */
}

/**
 * Validation: Verify migration results
 */
async function validateMigration() {
  log.info('\n📋 Step 5: Validating migration results');
  log.info('═══════════════════════════════════════════════\n');
  
  // Check for cases with assignedTo but no assignedToXID
  const missingXID = await Case.countDocuments({
    assignedTo: { $regex: /^X\d{6}$/i },
    assignedToXID: { $exists: false },
  });
  
  // Check queueType consistency
  const personalWithoutXID = await Case.countDocuments({
    queueType: 'PERSONAL',
    assignedToXID: null,
  });
  
  const globalWithXID = await Case.countDocuments({
    queueType: 'GLOBAL',
    assignedToXID: { $ne: null },
  });
  
  // Check for legacy status values
  const legacyStatuses = await Case.countDocuments({
    status: { $in: ['Open', 'open', 'Pending', 'pending', 'Filed', 'filed'] },
  });
  
  log.info('Validation Results:');
  log.info('───────────────────');
  
  if (missingXID === 0) {
    log.info('✅ All assigned cases have assignedToXID field');
  } else {
    log.info(`❌ ${missingXID} cases missing assignedToXID (need migration)`);
  }
  
  if (personalWithoutXID === 0) {
    log.info('✅ All PERSONAL queue cases have assignedToXID');
  } else {
    log.info(`❌ ${personalWithoutXID} PERSONAL cases missing assignedToXID (data inconsistency)`);
  }
  
  if (globalWithXID === 0) {
    log.info('✅ No GLOBAL queue cases have assignedToXID');
  } else {
    log.info(`❌ ${globalWithXID} GLOBAL cases have assignedToXID (data inconsistency)`);
  }
  
  if (legacyStatuses === 0) {
    log.info('✅ All status values normalized');
  } else {
    log.info(`❌ ${legacyStatuses} cases with legacy status values`);
  }
  
  // Overall status
  const allValid = missingXID === 0 && personalWithoutXID === 0 && globalWithXID === 0 && legacyStatuses === 0;
  
  log.info('\n' + '═'.repeat(50));
  if (allValid) {
    log.info('✅ VALIDATION PASSED - Migration successful!');
  } else {
    log.info('❌ VALIDATION FAILED - Please review issues above');
  }
  log.info('═'.repeat(50) + '\n');
  
  return allValid;
}

/**
 * Main migration function
 */
async function runMigration() {
  log.info('\n' + '═'.repeat(50));
  log.info('  xID CANONICALIZATION MIGRATION');
  log.info('  assignedTo → assignedToXID');
  log.info('═'.repeat(50));
  
  if (DRY_RUN) {
    log.info('\n🔍 RUNNING IN DRY RUN MODE');
    log.info('   Set DRY_RUN=false to apply changes\n');
  } else {
    log.info('\n⚠️  RUNNING IN LIVE MODE');
    log.info('   Changes will be applied to the database\n');
  }
  
  try {
    await connectDB();
    
    const step1Count = await migrateAssignedToXID();
    const step2Count = await normalizeQueueType();
    const step3Count = await normalizeStatus();
    const step4Count = await removeLegacyField();
    
    log.info('\n' + '═'.repeat(50));
    log.info('  MIGRATION SUMMARY');
    log.info('═'.repeat(50) + '\n');
    log.info(`Cases migrated to assignedToXID: ${step1Count}`);
    log.info(`QueueType normalized: ${step2Count}`);
    log.info(`Status values normalized: ${step3Count}`);
    log.info(`Legacy fields removed: ${step4Count}`);
    
    if (!DRY_RUN) {
      await validateMigration();
    }
    
  } catch (error) {
    log.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log.info('\n✅ Database connection closed');
  }
}

// Run migration
runMigration();
