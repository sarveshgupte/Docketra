#!/usr/bin/env node
const assert = require('assert');
const { lookupCompany, generateDeterministicCompany, ROC_MAP, COMPANY_TYPE_MAP } = require('../src/services/mca.service');

(async () => {
  console.log('Running MCA Service tests...');

  // Test 1: Reject missing input
  await assert.rejects(
    async () => {
      await lookupCompany({});
    },
    /Either CIN or PAN must be provided/
  );

  // Test 2: Reject invalid CIN format
  await assert.rejects(
    async () => {
      await lookupCompany({ cin: 'INVALID123' });
    },
    (err) => err.code === 'INVALID_CIN_FORMAT' && err.statusCode === 400
  );

  // Test 3: Reject invalid PAN format
  await assert.rejects(
    async () => {
      await lookupCompany({ pan: '12345ABC' });
    },
    (err) => err.code === 'INVALID_PAN_FORMAT' && err.statusCode === 400
  );

  // Test 4: Parse valid Maharashtra CIN
  const mhResult = await lookupCompany({ cin: 'U72900MH2021PTC368291' });
  assert.strictEqual(mhResult.cin, 'U72900MH2021PTC368291');
  assert.strictEqual(mhResult.roc, 'ROC Mumbai');
  assert.strictEqual(mhResult.state, 'Maharashtra');
  assert.strictEqual(mhResult.city, 'Mumbai');
  assert.strictEqual(mhResult.entityType, 'Private Limited Company');
  assert.strictEqual(mhResult.companyStatus, 'Active');
  assert.ok(Array.isArray(mhResult.directors) && mhResult.directors.length >= 2, 'Should include directors');
  assert.ok(mhResult.directors[0].din.startsWith('0'), 'DIN should start with 0');
  assert.ok(Array.isArray(mhResult.pastFilings) && mhResult.pastFilings.length >= 2, 'Should include past filings');
  assert.ok(mhResult.pastFilings.some((f) => f.formName === 'AOC-4'), 'Should include AOC-4');
  assert.ok(mhResult.pastFilings.some((f) => f.formName === 'MGT-7'), 'Should include MGT-7');

  // Test 5: Parse valid Gujarat Public Limited CIN
  const gjResult = await lookupCompany({ cin: 'L17120GJ1998PLC034567' });
  assert.strictEqual(gjResult.cin, 'L17120GJ1998PLC034567');
  assert.strictEqual(gjResult.roc, 'ROC Ahmedabad');
  assert.strictEqual(gjResult.state, 'Gujarat');
  assert.strictEqual(gjResult.entityType, 'Public Limited Company');

  // Test 6: Lookup by PAN
  const panResult = await lookupCompany({ pan: 'AABCU3456F' });
  assert.strictEqual(panResult.pan, 'AABCU3456F');
  assert.ok(panResult.cin.length === 21, 'Derived CIN should be 21 chars');
  assert.ok(panResult.businessName, 'Should have business name');
  assert.ok(panResult.pastFilings.length > 0, 'Should have past filings');

  console.log('✓ All MCA Service tests passed successfully!');
})();
