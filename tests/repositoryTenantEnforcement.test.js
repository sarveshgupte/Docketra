#!/usr/bin/env node
const assert = require('assert');
const CaseRepository = require('../src/repositories/CaseRepository');
const ClientRepository = require('../src/repositories/ClientRepository');
const UserRepository = require('../src/repositories/UserRepository');

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

shouldRequireTenantIdInRepositories().catch((err) => {
  console.error('Repository tenant enforcement tests failed:', err);
  process.exit(1);
});
