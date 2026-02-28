#!/usr/bin/env node
const assert = require('assert');

async function testAuditModelImmutabilityHooks() {
  const AuditLog = require('../src/models/AuditLog.model');
  const pres = AuditLog.schema.s.hooks._pres;
  const updateHooks = pres.get('updateOne') || [];
  const deleteHooks = pres.get('deleteOne') || [];

  assert.ok(updateHooks.length > 0, 'updateOne hook must exist to enforce immutability');
  assert.ok(deleteHooks.length > 0, 'deleteOne hook must exist to enforce immutability');
  console.log('✓ AuditLog has immutable update/delete hooks');
}

async function testTenantAndNetworkMetadataRequired() {
  const { logForensicAudit } = require('../src/services/forensicAudit.service');

  await assert.rejects(
    () => logForensicAudit({
      entityType: 'AUTH',
      entityId: 'X001',
      action: 'Login',
      performedBy: 'X001',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    }),
    /tenantId is required/
  );

  await assert.rejects(
    () => logForensicAudit({
      tenantId: 'FIRM001',
      entityType: 'AUTH',
      entityId: 'X001',
      action: 'Login',
      performedBy: 'X001',
      ipAddress: '',
      userAgent: '',
    }),
    /ipAddress and userAgent are required/
  );

  console.log('✓ Audit logging rejects missing tenant/network metadata');
}

async function testChangeDiffLogic() {
  const { computeChangedFields } = require('../src/services/forensicAudit.service');
  const diff = computeChangedFields({ status: 'OPEN', untouched: 1 }, { status: 'FILED', untouched: 1 });
  assert.deepStrictEqual(diff.oldValue, { status: 'OPEN' });
  assert.deepStrictEqual(diff.newValue, { status: 'FILED' });
  console.log('✓ Diff logic stores changed fields only');
}

async function testStatusChangeWritesForensicAudit() {
  const fs = require('fs');
  const source = fs.readFileSync('src/services/case.service.js', 'utf8');
  assert.ok(source.includes("action: 'CASE_STATUS_CHANGED'"), 'Case status audit action must be logged');
  assert.ok(source.includes('safeLogForensicAudit({'), 'Case status change must call centralized forensic audit service');
  console.log('✓ Case status path is wired to forensic audit logger');
}

async function testImpersonationAndFileDownloadLogging() {
  const forensic = require('../src/services/forensicAudit.service');
  const captured = [];
  const originalSafeLog = forensic.safeLogForensicAudit;
  forensic.safeLogForensicAudit = async (payload) => {
    captured.push(payload);
    return null;
  };

  const superadmin = require('../src/controllers/superadmin.controller');
  const reqSwitch = {
    body: { firmId: 'FIRM001', sessionId: 'sess-1' },
    user: { _id: '507f1f77bcf86cd799439011', xID: 'SUPERADMIN', role: 'SuperAdmin' },
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  };
  const resSwitch = { statusCode: 200, status(code){ this.statusCode = code; return this; }, json(body){ this.body = body; return this; } };
  await superadmin.switchFirm(reqSwitch, resSwitch);
  assert.strictEqual(resSwitch.statusCode, 403, 'switchFirm remains blocked by hard guard');
  assert.ok(captured.some((entry) => entry.action === 'IMPERSONATION_START'), 'Impersonation start must be audited');

  const File = require('../src/models/File.model');
  const TenantStorageConfig = require('../src/models/TenantStorageConfig.model');
  const storageFactory = require('../src/storage/StorageProviderFactory');

  const originalFileFindOne = File.findOne;
  const originalFileUpdateOne = File.updateOne;
  const originalStorageFindOne = TenantStorageConfig.findOne;
  const originalProvider = storageFactory.getProviderForTenant;

  File.findOne = async () => ({ _id: 'file123', tenantId: 'FIRM001', caseId: 'CASE-1', objectKey: 'obj/key', status: 'AVAILABLE' });
  File.updateOne = async () => null;
  TenantStorageConfig.findOne = () => ({ select: async () => ({ status: 'ACTIVE' }) });
  storageFactory.getProviderForTenant = async () => ({
    generateDownloadUrl: async () => 'https://example.com/download',
    getFileMetadata: async () => ({ size: 1 }),
  });

  delete require.cache[require.resolve('../src/controllers/files.controller')];
  const filesController = require('../src/controllers/files.controller');

  const reqDownload = {
    firmId: 'FIRM001',
    params: { fileId: 'file123' },
    user: { _id: 'u1', xID: 'X100', role: 'Employee' },
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  };
  const resDownload = { jsonBody: null, statusCode: 200, status(code){ this.statusCode=code; return this; }, json(body){ this.jsonBody=body; return this; } };
  await filesController.downloadFile(reqDownload, resDownload);

  assert.strictEqual(resDownload.statusCode, 200);
  assert.ok(captured.some((entry) => entry.action === 'FILE_DOWNLOAD'), 'File download must be audited');

  File.findOne = originalFileFindOne;
  File.updateOne = originalFileUpdateOne;
  TenantStorageConfig.findOne = originalStorageFindOne;
  storageFactory.getProviderForTenant = originalProvider;
  forensic.safeLogForensicAudit = originalSafeLog;

  console.log('✓ Impersonation and file download actions are audited');
}

async function run() {
  await testAuditModelImmutabilityHooks();
  await testTenantAndNetworkMetadataRequired();
  await testChangeDiffLogic();
  await testStatusChangeWritesForensicAudit();
  await testImpersonationAndFileDownloadLogging();
  console.log('\nForensic audit trail tests passed.');
}

run().catch((error) => {
  console.error('Forensic audit trail tests failed');
  console.error(error);
  process.exit(1);
});
