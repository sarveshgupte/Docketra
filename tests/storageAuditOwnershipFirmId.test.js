#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
let auditCalls = [];
let resolveMode = 'success';
let runBackupThrows = false;
let auditThrows = false;
let warnEvents = [];

Module._load = function(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return {
      findById: () => ({ select: () => ({ lean: async () => ({ storage: { mode: 'firm_connected', provider: 'google_drive' } }) }) }),
    };
  }
  if (request === '../services/tenantIdentity.service') {
    return { resolveStorageContextFromTenantId: async () => (resolveMode === 'missing' ? null : { ownershipFirmId: 'firm-owner-9' }) };
  }
  if (request === '../services/googleDrive.service') {
    return { googleDriveService: { markStorageDisconnected: async () => {}, getClient: async () => ({ providerType: 'google_drive', rootFolderId: 'r1' }) }, PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' } };
  }
  if (request.includes('TokenEncryption.service')) return { encrypt: (v) => v, decrypt: () => '{}' };
  if (request === '../services/storageBackup.service') {
    return { storageBackupService: {
      runBackupForFirm: async () => { if (runBackupThrows) throw new Error('backup failed'); return { exportId: 'exp-1', fileCount: 1, archiveObjectKey: 'k', checksum: 'c', size: 10 }; },
      buildBackupAccess: async () => ({ downloadUrl: 'https://example.com/x' }),
      emailBackupNotification: async () => {},
    } };
  }
  if (request === '../services/storage/providers/GoogleDriveProvider') return function G(){};
  if (request === '../services/storage/providers/OneDriveProvider') return function O(){};
  if (request === '../services/storage/errors/StorageErrors') return { StorageValidationError: class extends Error {} };
  if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: {} };
  if (request === '../services/storageAdapter.service') return { S3Adapter: function(){} };
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async (p) => { auditCalls.push(p); if (auditThrows) throw new Error('audit down'); } };
  if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: { STORAGE_EXPORT_FAILED: 'STORAGE_EXPORT_FAILED', EXPORT_DOWNLOAD_UNAVAILABLE: 'X' }, logPilotEvent: () => {} };
  if (request === '../utils/log') return { warn: (_m,ctx) => { warnEvents.push(ctx?.event); }, error: () => {}, info: () => {} };
  if (request === '../utils/role.utils') return { isAdminRole: () => true, isPrimaryAdminRole: () => true };
  if (request === '../utils/requestCookies') return { getCookieValue: () => null };
  if (request === 'jsonwebtoken') return { verify: () => ({}) };
  return originalLoad.apply(this, arguments);
};

const { exportFirmStorage, downloadFirmStorageExport, disconnectStorage } = require('../src/controllers/storage.controller');

function mkRes() { return { statusCode: 200, body: null, redirected: null, status(c){ this.statusCode=c; return this; }, json(p){ this.body=p; return this; }, redirect(u){ this.redirected=u; return this; } }; }

async function testExportFailureUsesOwnershipAuditTenant() {
  auditCalls = []; warnEvents = []; resolveMode = 'success'; runBackupThrows = true; auditThrows = false;
  const req = { firmId: 'tenant-default-9', user: { role: 'PRIMARY_ADMIN' } };
  const res = mkRes();
  await exportFirmStorage(req, res);
  assert.strictEqual(res.statusCode, 500);
  const failedAudit = auditCalls.find((c) => c.action === 'EXPORT_FAILED');
  assert.strictEqual(failedAudit.tenantId, 'firm-owner-9');
  assert.strictEqual(failedAudit.metadata.runtimeTenantId, 'tenant-default-9');
}

async function testOwnershipMissingFailsClosedWithoutUnsafeAudit() {
  auditCalls = []; warnEvents = []; resolveMode = 'missing'; runBackupThrows = false; auditThrows = false;
  const req = { firmId: 'tenant-default-9', user: { role: 'PRIMARY_ADMIN' }, originalUrl: '/api/storage/export' };
  const res = mkRes();
  await exportFirmStorage(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(auditCalls.length, 0);
}

async function testAuditWriteFailureDoesNotMaskExportFailure() {
  auditCalls = []; warnEvents = []; resolveMode = 'success'; runBackupThrows = true; auditThrows = true;
  const req = { firmId: 'tenant-default-9', user: { role: 'PRIMARY_ADMIN' } };
  const res = mkRes();
  await exportFirmStorage(req, res);
  assert.strictEqual(res.statusCode, 500);
  assert.ok(warnEvents.includes('storage_export_failed_audit_write_failed'));
}

async function testDownloadAndDisconnectAuditNeverUseRuntimeTenantId() {
  auditCalls = []; warnEvents = []; resolveMode = 'success'; runBackupThrows = false; auditThrows = false;
  const reqDl = { firmId: 'tenant-default-9', params: { token: 't1' }, user: { role: 'PRIMARY_ADMIN' } };
  const resDl = mkRes();
  await downloadFirmStorageExport(reqDl, resDl);
  const dlAudit = auditCalls.find((c) => c.action === 'EXPORT_DOWNLOAD_LINK_ISSUED');
  assert.strictEqual(dlAudit.tenantId, 'firm-owner-9');
  assert.notStrictEqual(dlAudit.tenantId, reqDl.firmId);

  const reqDis = { firmId: 'tenant-default-9', user: { role: 'PRIMARY_ADMIN' } };
  const resDis = mkRes();
  await disconnectStorage(reqDis, resDis);
  const disAudit = auditCalls.find((c) => c.action === 'CONFIG_CHANGED');
  assert.strictEqual(disAudit.tenantId, 'firm-owner-9');
  assert.notStrictEqual(disAudit.tenantId, reqDis.firmId);
}

async function run() {
  await testExportFailureUsesOwnershipAuditTenant();
  await testOwnershipMissingFailsClosedWithoutUnsafeAudit();
  await testAuditWriteFailureDoesNotMaskExportFailure();
  await testDownloadAndDisconnectAuditNeverUseRuntimeTenantId();
  console.log('storageAuditOwnershipFirmId.test.js passed');
}

run().catch((e)=>{ console.error(e); process.exit(1); }).finally(()=>{ Module._load = originalLoad; });
