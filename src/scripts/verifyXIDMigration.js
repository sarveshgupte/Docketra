/**
 * Verification Script for xID Canonicalization
 * 
 * This script verifies that all the xID migration changes have been implemented
 * correctly by checking key files and code patterns.
 * 
 * Run this after applying the migration to verify everything is in place.
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/log');

log.info('\n' + '═'.repeat(50));
log.info('  xID CANONICALIZATION VERIFICATION');
log.info('═'.repeat(50) + '\n');

let errors = 0;
let warnings = 0;
let passed = 0;

function checkFileContains(filePath, pattern, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(pattern)) {
      log.info(`✅ ${description}`);
      passed++;
      return true;
    } else {
      log.info(`❌ ${description}`);
      errors++;
      return false;
    }
  } catch (error) {
    log.info(`❌ ${description} - File not found: ${filePath}`);
    errors++;
    return false;
  }
}

function checkFileDoesNotContain(filePath, pattern, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(pattern)) {
      log.info(`✅ ${description}`);
      passed++;
      return true;
    } else {
      log.info(`⚠️  ${description}`);
      warnings++;
      return false;
    }
  } catch (error) {
    log.info(`❌ ${description} - File not found: ${filePath}`);
    errors++;
    return false;
  }
}

log.info('📋 Checking Case Model Schema\n');
checkFileContains('models/Case.model.js', 'assignedToXID:', 'Case model has assignedToXID field');
checkFileContains('models/Case.model.js', 'assignedToXID: 1', 'Index on assignedToXID exists');
checkFileContains('models/Case.model.js', 'DEPRECATED', 'Legacy assignedTo field is marked deprecated');

log.info('\n📋 Checking Assignment Service\n');
checkFileContains('services/caseAssignment.service.js', 'assignedToXID:', 'Assignment service writes to assignedToXID');
checkFileDoesNotContain('services/caseAssignment.service.js', 'assignedTo: user.xID', 'Assignment service does not write to legacy assignedTo');

log.info('\n📋 Checking Bulk Pull API\n');
checkFileContains('controllers/case.controller.js', 'userXID', 'Bulk pull accepts userXID parameter');
checkFileContains('controllers/case.controller.js', 'userEmail parameter is deprecated', 'Bulk pull rejects userEmail parameter');

log.info('\n📋 Checking Worklist Queries\n');
checkFileContains('controllers/search.controller.js', 'assignedToXID: user.xID', 'Employee worklist queries assignedToXID');
checkFileContains('controllers/caseActions.controller.js', 'assignedToXID: req.user.xID', 'My Pending Cases queries assignedToXID');

log.info('\n📋 Checking Case History Model\n');
checkFileContains('models/CaseHistory.model.js', 'performedByXID:', 'CaseHistory model has performedByXID field');
checkFileContains('models/CaseHistory.model.js', 'performedByXID: 1', 'Index on performedByXID exists');

log.info('\n📋 Checking Reports Controller\n');
checkFileContains('controllers/reports.controller.js', 'assignedToXID:', 'Reports controller uses assignedToXID');
checkFileContains('controllers/reports.controller.js', 'matchStage.assignedToXID = assignedTo', 'Reports controller queries assignedToXID');

log.info('\n📋 Checking Migration Script\n');
checkFileContains('scripts/migrateToAssignedToXID.js', 'assignedTo → assignedToXID', 'Migration script exists');
checkFileContains('scripts/migrateToAssignedToXID.js', 'DRY_RUN', 'Migration script has dry-run mode');

log.info('\n' + '═'.repeat(50));
log.info('  VERIFICATION RESULTS');
log.info('═'.repeat(50) + '\n');
log.info(`✅ Passed:   ${passed}`);
log.info(`⚠️  Warnings: ${warnings}`);
log.info(`❌ Errors:   ${errors}\n`);

if (errors > 0) {
  log.info('❌ VERIFICATION FAILED - Please fix errors above\n');
  process.exit(1);
} else if (warnings > 0) {
  log.info('⚠️  VERIFICATION PASSED WITH WARNINGS\n');
  process.exit(0);
} else {
  log.info('✅ VERIFICATION PASSED - All checks successful!\n');
  process.exit(0);
}
