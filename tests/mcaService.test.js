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
  assert.ok(Array.isArray(mhResult.charges) && mhResult.charges.length >= 1, 'Should include index of charges');
  assert.ok(mhResult.charges[0].chargeId.startsWith('CHG-'), 'Charge ID should start with CHG-');
  assert.ok(mhResult.charges[0].chargeHolder, 'Should contain chargeHolder/lender name');
  assert.ok(mhResult.charges[0].amount > 0, 'Charge amount should be positive');
  assert.ok(['Open', 'Satisfied', 'Closed'].includes(mhResult.charges[0].status), 'Status should be valid');

  // Test 5: Parse valid Gujarat Public Limited CIN
  const gjResult = await lookupCompany({ cin: 'L17120GJ1998PLC034567' });
  assert.strictEqual(gjResult.cin, 'L17120GJ1998PLC034567');
  assert.strictEqual(gjResult.roc, 'ROC Ahmedabad');
  assert.strictEqual(gjResult.state, 'Gujarat');
  assert.strictEqual(gjResult.entityType, 'Public Limited Company');
  assert.ok(gjResult.charges.length > 0, 'Public company should include charges');

  // Test 6: Lookup by PAN
  const panResult = await lookupCompany({ pan: 'AABCU3456F' });
  assert.strictEqual(panResult.pan, 'AABCU3456F');
  assert.ok(panResult.cin.length === 21, 'Derived CIN should be 21 chars');
  assert.ok(panResult.businessName, 'Should have business name');
  assert.ok(panResult.pastFilings.length > 0, 'Should have past filings');
  assert.ok(panResult.charges.length > 0, 'PAN lookup should generate charges');

  // Test 7: Gateway Connection Tester
  const { testGatewayConnection } = require('../src/services/mca.service');
  const sandboxTest = await testGatewayConnection({ provider: 'sandbox' });
  assert.strictEqual(sandboxTest.success, true);
  assert.strictEqual(sandboxTest.provider, 'sandbox');
  assert.ok(sandboxTest.message.includes('Regulatory Sandbox operational'));

  // Test 8: Gateway connection tester requires API key for non-sandbox
  await assert.rejects(
    async () => {
      await testGatewayConnection({ provider: 'surepass', apiKey: '' });
    },
    /API Key is required/
  );

  console.log('✓ All MCA Service tests passed successfully!');
})();
