#!/usr/bin/env node
const assert = require('assert');
const CaseRepository = require('../src/repositories/CaseRepository');
const ClientRepository = require('../src/repositories/ClientRepository');
const UserRepository = require('../src/repositories/UserRepository');
const Case = require('../src/models/Case.model');

async function shouldRequireTenantIdInRepositories() {
  await assert.rejects(
    () => CaseRepository.find(null, {}, 'Admin'),
    /TenantId required/
  );
  await assert.rejects(
    () => ClientRepository.find(null, {}, 'Admin'),
    /TenantId required/
  );
  await assert.rejects(
    Promise.resolve().then(() => UserRepository.findById(null, '507f1f77bcf86cd799439011')),
    /TenantId required/
  );
  console.log('✓ Repository methods reject missing tenantId');
}

async function shouldApplyTenantScopedCaseLookup() {
  const originalFindOne = Case.findOne;
  let capturedFilter = null;
  Case.findOne = async (filter) => {
    capturedFilter = filter;
    return null;
  };

  await CaseRepository.findById('firm-b', '507f1f77bcf86cd799439011', 'Admin');
  assert.strictEqual(capturedFilter.firmId, 'firm-b', 'Case lookup must include resolved tenant firmId');

  Case.findOne = originalFindOne;
  console.log('✓ Case repository lookups remain tenant-scoped');
}

(async function run() {
  await shouldRequireTenantIdInRepositories();
  await shouldApplyTenantScopedCaseLookup();
})().catch((err) => {
  console.error('Repository tenant enforcement tests failed:', err);
  process.exit(1);
});
