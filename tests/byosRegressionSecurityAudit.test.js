#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(64);
process.env.STORAGE_TOKEN_SECRET = process.env.STORAGE_TOKEN_SECRET || 'test-storage-secret';

const { encrypt } = require('../src/services/storage/services/TokenEncryption.service');
const { resolveFirmStorageState } = require('../src/services/storage/resolveFirmStorageState');
const { getStorageStateDriftIssues } = require('../src/services/storage/storageStateDriftReport');

const originalLoad = Module._load;

(async function run() {
  const state = {
    attachmentCreatePayload: null,
    backupCreatePayload: null,
    backupUpdatePayload: null,
    backupAuditPayloads: [],
    providerCalls: [],
    factoryCalls: 0,
    logLines: [],
    firmDoc: {
      storage: { mode: 'firm_connected', provider: 'google_drive' },
      storageConfig: { provider: 'google_drive', credentials: encrypt(JSON.stringify({ refreshToken: 'rt', rootFolderId: 'rfid' })) },
    },
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Attachment.model') {
      return {
        findOne() { return { sort: () => ({ select: () => ({ lean: async () => ({ version: 1 }) }) }) }; },
        async create(payload) { state.attachmentCreatePayload = payload; return { _id: 'att-1', ...payload, toObject: () => ({ _id: 'att-1', ...payload }) }; },
      };
    }
    if (request === '../models/Case.model') {
      return { findOne: () => ({ select: () => ({ lean: async () => ({ caseId: 'DCK-1', caseNumber: 'DCK-1', firmId: 'F1' }) }) }) };
    }
    if (request === '../models/Firm.model') {
      return {
        findById: () => ({ select: () => ({ lean: async () => state.firmDoc }) }),
      };
    }
    if (request === '../models/BackupJob.model') {
      return {
        create: async (payload) => { state.backupCreatePayload = payload; return { _id: 'job-1' }; },
        updateOne: async (_q, payload) => { state.backupUpdatePayload = payload; return {}; },
      };
    }
    if (request === '../models/AuditLog.model') return { create: async (payload) => { state.backupAuditPayloads.push(payload); return {}; } };
    if (request === './email.service') return { sendEmail: async () => ({}) };
    if (request === '../utils/log') return { warn: (...args) => state.logLines.push(args), error: (...args) => state.logLines.push(args), info: (...args) => state.logLines.push(args) };
    if (request === './storage/StorageProviderFactory' || request === '../services/storage/StorageProviderFactory') {
      return {
        StorageProviderFactory: {
          async getProvider() {
            state.factoryCalls += 1;
            return {
              providerName: 's3',
              async testConnection() { return { healthy: true }; },
              async uploadFile(parent, name, streamOrBuffer, mime) {
                state.providerCalls.push({ fn: 'uploadFile', parent, name, mime, type: Buffer.isBuffer(streamOrBuffer) ? 'buffer' : typeof streamOrBuffer });
                return { fileId: `s3://${name}`, mimeType: mime, size: 3, checksum: 'sha256-1', version: 'v1' };
              },
              async downloadFile(fileId) { state.providerCalls.push({ fn: 'downloadFile', fileId }); return { on() {}, pipe() {} }; },
              async listFiles() { state.providerCalls.push({ fn: 'listFiles' }); return []; },
            };
          },
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    const fileSvc = require('../src/services/docketFileStorage.service');
    const { storageBackupService } = require('../src/services/storageBackup.service');
    const { requireActiveStorageProvider } = require('../src/middleware/requireStorageConnected');

    await fileSvc.uploadFile({ file: Buffer.from('abc'), fileName: 'doc.pdf', fileType: 'application/pdf', docketId: 'DCK-1', firmId: 'F1', uploadedBy: 'X1', uploadedByName: 'Ada' });
    assert.ok(state.attachmentCreatePayload);
    const forbiddenBinaryKeys = ['buffer', 'fileBuffer', 'content', 'binary', 'base64', 'rawPayload', 'zipPayload', 'archiveBytes'];
    forbiddenBinaryKeys.forEach((key) => assert.ok(!Object.prototype.hasOwnProperty.call(state.attachmentCreatePayload, key), `attachment payload unexpectedly includes ${key}`));
    assert.strictEqual(state.attachmentCreatePayload.storageProvider, 's3');
    assert.ok(state.attachmentCreatePayload.storageFileId);
    assert.strictEqual(state.attachmentCreatePayload.mimeType, 'application/pdf');

    const testZipPath = path.join(os.tmpdir(), 'docketra-byos-reg.zip');
    const testExportDir = path.join(os.tmpdir(), 'docketra-byos-reg');
    storageBackupService.createBackupArchiveOnTempDisk = async () => ({ zipPath: testZipPath, exportDir: testExportDir, fileCount: 0 });
    storageBackupService.uploadBackupToProvider = async () => ({ archiveObjectKey: 'backups/nightly/x.zip.enc', providerFileId: 'prov-1' });
    fs.writeFileSync(testZipPath, 'zip');
    await storageBackupService.runBackupForFirm('F1', {});

    forbiddenBinaryKeys.forEach((key) => assert.ok(!Object.prototype.hasOwnProperty.call(state.backupCreatePayload, key), `backup create unexpectedly includes ${key}`));
    assert.ok(state.backupUpdatePayload.$set.metadata);
    forbiddenBinaryKeys.forEach((key) => assert.ok(!Object.prototype.hasOwnProperty.call(state.backupUpdatePayload.$set.metadata, key), `backup metadata unexpectedly includes ${key}`));

    const req = { firmId: 'F1', user: { firmId: 'F1' } };
    let calledNext = false;
    await requireActiveStorageProvider(req, { status: () => ({ json: () => ({}) }) }, () => { calledNext = true; });
    assert.strictEqual(calledNext, true);
    assert.strictEqual(req.storageContext.providerName, 's3');

    const unsupported = resolveFirmStorageState({ storage: { mode: 'firm_connected' }, storageConfig: { provider: 'unknown_vendor' } });
    assert.strictEqual(unsupported.connectionStatus, 'DISCONNECTED');
    const issues = getStorageStateDriftIssues({ storage: { mode: 'firm_connected' }, storageConfig: { provider: 'google_drive' } });
    assert.ok(issues.includes('STORAGECONFIG_PROVIDER_WITHOUT_LEGACY_PROVIDER'));

    const normalizedGoogle = resolveFirmStorageState({ storage: { mode: 'firm_connected', provider: 'google-drive' }, storageConfig: {} });
    assert.strictEqual(normalizedGoogle.canonicalProvider, 'google_drive');
    const normalizedManaged = resolveFirmStorageState({ storage: {}, storageConfig: { provider: 'docketra_drive' } });
    assert.strictEqual(normalizedManaged.canonicalProvider, 'docketra_managed');
    assert.strictEqual(resolveFirmStorageState({ storage: { mode: 'docketra_managed' }, storageConfig: null }).connectionStatus, 'ACTIVE_MANAGED');

    const logDump = JSON.stringify(state.logLines);
    ['refreshToken', 'googleRefreshToken', 'accessToken', 'secretAccessKey', 'sessionToken'].forEach((secret) => {
      assert.ok(!logDump.includes(secret), `logs must not leak ${secret}`);
    });

    assert.ok(state.factoryCalls >= 3, 'StorageProviderFactory should be used by runtime paths');

    console.log('✓ BYOS regression + security audit coverage');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    const testZipPath = path.join(os.tmpdir(), 'docketra-byos-reg.zip');
    const testExportDir = path.join(os.tmpdir(), 'docketra-byos-reg');
    fs.rmSync(testZipPath, { force: true });
    fs.rmSync(testExportDir, { recursive: true, force: true });
    Module._load = originalLoad;
  }
})();
