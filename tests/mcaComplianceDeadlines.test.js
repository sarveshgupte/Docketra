#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { computeComplianceDeadlines, generateDeterministicCompany } = require('../src/services/mca.service');

(async () => {
  console.log('Running MCA Compliance Deadlines tests...');

  // Test 1: Standard Private Limited Company deadlines
  const pvtDeadlines = computeComplianceDeadlines({
    pastFilings: [],
    directors: [
      { din: '01234567', name: 'Rajesh Sharma' },
      { din: '07654321', name: 'Vikram Mehta' },
    ],
    entityType: 'Private Limited Company',
  });

  assert.ok(Array.isArray(pvtDeadlines), 'Should return an array of deadlines');
  assert.strictEqual(pvtDeadlines.length, 4, 'Should contain 4 statutory filing obligations');

  const aoc4 = pvtDeadlines.find((d) => d.formName === 'AOC-4');
  assert.ok(aoc4, 'Should include AOC-4');
  assert.ok(aoc4.dueDate.endsWith('-10-30'), 'AOC-4 for standard company should be due on 30th October');
  assert.ok(aoc4.basis.includes('Section 137(1)'), 'AOC-4 legal basis should cite Section 137(1)');

  const mgt7 = pvtDeadlines.find((d) => d.formName === 'MGT-7');
  assert.ok(mgt7, 'Should include MGT-7');
  assert.ok(mgt7.dueDate.endsWith('-11-29'), 'MGT-7 should be due on 29th November');
  assert.ok(mgt7.basis.includes('Section 92(4)'), 'MGT-7 legal basis should cite Section 92(4)');

  const dir3Kyc = pvtDeadlines.find((d) => d.formName === 'DIR-3 KYC');
  assert.ok(dir3Kyc, 'Should include DIR-3 KYC');
  assert.ok(dir3Kyc.dueDate.endsWith('-09-30'), 'DIR-3 KYC should be due on 30th September');
  assert.strictEqual(dir3Kyc.targetDirectors.length, 2, 'Should map target directors');
  assert.ok(dir3Kyc.targetDirectors[0].includes('Rajesh Sharma (DIN 01234567)'), 'Should contain director name and DIN');

  const dpt3 = pvtDeadlines.find((d) => d.formName === 'DPT-3');
  assert.ok(dpt3, 'Should include DPT-3');
  assert.ok(dpt3.dueDate.endsWith('-06-30'), 'DPT-3 should be due on 30th June');

  // Test 2: One Person Company (OPC) special provisions
  const opcDeadlines = computeComplianceDeadlines({
    pastFilings: [],
    directors: [{ din: '09876543', name: 'Sunil Rao' }],
    entityType: 'One Person Company',
  });

  const opcAoc4 = opcDeadlines.find((d) => d.formName === 'AOC-4');
  assert.ok(opcAoc4, 'Should include AOC-4 for OPC');
  assert.ok(opcAoc4.dueDate.endsWith('-09-27'), 'OPC AOC-4 should be due on 27th September (180 days)');
  assert.ok(opcAoc4.basis.includes('180 days'), 'OPC basis should cite 180 days');

  const opcMgt7 = opcDeadlines.find((d) => d.formName === 'MGT-7A');
  assert.ok(opcMgt7, 'OPC should use MGT-7A abridged annual return');

  // Test 3: Deterministic mock integration
  const mockCompany = generateDeterministicCompany('U72900MH2021PTC368291');
  assert.ok(Array.isArray(mockCompany.complianceDeadlines), 'Deterministic company should include complianceDeadlines');
  assert.ok(mockCompany.complianceDeadlines.length >= 4, 'Should generate deadlines');

  console.log('✓ All MCA Compliance Deadlines unit tests passed successfully!');
})();
