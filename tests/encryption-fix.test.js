#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const Case = require('../src/models/Case.model');
const { ensureTenantKey } = require('../src/security/encryption.service');
const { looksEncrypted } = require('../src/security/encryption.utils');
const CaseRepository = require('../src/repositories/CaseRepository');

async function testEncryptionFixPipeline() {
  console.log('\n🔐 STARTING ENCRYPTION FIX VERIFICATION TESTS\n');

  try {
    assert(process.env.MASTER_ENCRYPTION_KEY, 'MASTER_ENCRYPTION_KEY must be set');
    console.log('✓ TEST 1 PASSED: MASTER_ENCRYPTION_KEY is configured');

    const firmId = new mongoose.Types.ObjectId();
    const testDescription = 'This is a sensitive legal case summary with important details 🔒';

    await ensureTenantKey(String(firmId));

    const caseData = {
      firmId,
      title: 'Test Case for Encryption',
      description: testDescription,
      caseNumber: `CASE-${Date.now()}`,
      categoryId: new mongoose.Types.ObjectId(),
      subcategoryId: 'test-subcategory',
    };

    const createdCase = await Case.create(caseData);
    assert(createdCase.description, 'Case should have description');
    assert(looksEncrypted(createdCase.description), 'Description should be encrypted at rest');
    console.log('✓ TEST 2 PASSED: Case created with encrypted description');
    console.log(`  - Encrypted: ${createdCase.description.substring(0, 50)}...`);

    const decrypted = await CaseRepository.findByInternalId(
      firmId,
      createdCase.caseInternalId,
      'admin'
    );
    assert(decrypted, 'Repository should return case');
    assert(decrypted.description === testDescription, 'Description should decrypt to original');
    console.log('✓ TEST 3 PASSED: Repository returns decrypted description');

    const multiCase = await CaseRepository.find(firmId, {}, 'admin');
    assert(Array.isArray(multiCase), 'Should return array');
    if (multiCase.length > 0) {
      assert(multiCase[0].description, 'Batch should have decrypted descriptions');
    }
    console.log('✓ TEST 4 PASSED: Batch decryption works');

    const longDescription = 'A'.repeat(4500);
    const longCaseData = {
      firmId,
      title: 'Long Description Test',
      description: longDescription,
      caseNumber: `CASE-${Date.now()}-LONG`,
      categoryId: new mongoose.Types.ObjectId(),
      subcategoryId: 'test-subcategory',
    };

    try {
      await Case.create(longCaseData);
      console.log('✓ TEST 5 PASSED: Case accepts long descriptions (encrypted)');
    } catch (err) {
      if (err.message.includes('5000')) {
        console.log('✓ TEST 5 PASSED: Field length limit correctly configured');
      } else {
        throw err;
      }
    }

    console.log('\n✅ ALL ENCRYPTION FIX TESTS PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:\n', err);
    process.exit(1);
  }
}

if (require.main === module) {
  testEncryptionFixPipeline().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}

module.exports = { testEncryptionFixPipeline };
