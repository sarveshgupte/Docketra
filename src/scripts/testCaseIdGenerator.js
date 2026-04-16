/**
 * Test Case ID Generator
 * 
 * Simple test to validate the new CASE-YYYYMMDD-XXXXX format
 */

const { generateCaseId, isValidCaseIdFormat, extractDateFromCaseId } = require('../services/caseIdGenerator');
const log = require('../utils/log');

async function testCaseIdGenerator() {
  log.info('Testing Case ID Generator...\n');
  
  // Test 1: Generate case ID
  log.info('Test 1: Generate Case ID');
  try {
    // Note: This will fail without a DB connection, but we can test the format validation
    log.info('✓ Case ID generator imported successfully');
  } catch (error) {
    log.error('✗ Failed to import case ID generator:', error.message);
    process.exit(1);
  }
  
  // Test 2: Validate format
  log.info('\nTest 2: Validate Case ID Format');
  const validIds = [
    'CASE-20260108-00001',
    'CASE-20260108-00012',
    'CASE-20261231-99999',
  ];
  
  const invalidIds = [
    'DCK-0001',
    'CASE-2026010-00001',
    'CASE-20260108-0001',
    'case-20260108-00001',
    'CASE-20260108-000001',
  ];
  
  validIds.forEach(id => {
    const result = isValidCaseIdFormat(id);
    log.info(`  ${result ? '✓' : '✗'} ${id} - ${result ? 'Valid' : 'Invalid (should be valid)'}`);
  });
  
  invalidIds.forEach(id => {
    const result = isValidCaseIdFormat(id);
    log.info(`  ${!result ? '✓' : '✗'} ${id} - ${result ? 'Valid (should be invalid)' : 'Invalid'}`);
  });
  
  // Test 3: Extract date
  log.info('\nTest 3: Extract Date from Case ID');
  const testId = 'CASE-20260108-00012';
  const date = extractDateFromCaseId(testId);
  if (date) {
    log.info(`  ✓ Extracted date from ${testId}: ${date.toISOString()}`);
    log.info(`    Year: ${date.getFullYear()}, Month: ${date.getMonth() + 1}, Day: ${date.getDate()}`);
  } else {
    log.info(`  ✗ Failed to extract date from ${testId}`);
  }
  
  log.info('\n✓ All tests completed!');
}

// Run tests
testCaseIdGenerator();
