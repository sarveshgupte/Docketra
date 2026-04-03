#!/usr/bin/env node
const assert = require('assert');

// The issue is that the actual files.controller.js requires getProviderForTenant BEFORE we override it.
// Node module caching means when files.controller.js is required, it holds a reference to the ORIGINAL getProviderForTenant function from the module!
// So we need to override it on the module cache, OR better yet, since the controller destructures it, we might need to mock the entire module via require.cache or similar before files.controller.js is required.

// Actually, wait, files.controller.js does:
// const { getProviderForTenant } = require('../services/storage/StorageProviderFactory');
// This destructures it!
// This means overriding StorageProviderFactory.getProviderForTenant AFTER files.controller.js is loaded does NOT WORK. The controller holds the original reference.
// The same applies to enqueueStorageJob etc.

// We need to use `require.cache` trick.

// First, require the dependencies we want to mock
const Case = require('../src/models/Case.model');
const File = require('../src/models/File.model');
const TenantStorageConfig = require('../src/models/TenantStorageConfig.model');
const StorageProviderFactoryModule = require('../src/services/storage/StorageProviderFactory');
const storageQueueModule = require('../src/queues/storage.queue');
const forensicAuditServiceModule = require('../src/services/forensicAudit.service');
const securityAuditServiceModule = require('../src/services/securityAudit.service');
const securityTelemetryServiceModule = require('../src/services/securityTelemetry.service');

// NOW we mutate the *exported* functions directly on the modules if they aren't destructured.
// Wait, if they are destructured, mutating the exported object DOES NOT WORK for files.controller.js because it already grabbed the reference when it ran.
// Actually, files.controller.js hasn't been required yet in this script if we don't require it at the top!
// So if we mutate the modules BEFORE requiring files.controller.js, it WILL destructure our mutated functions! Let's do that!

// Let's clear files.controller.js from require cache if it was loaded.
delete require.cache[require.resolve('../src/controllers/files.controller')];

// Set up mutable references that our mock functions will call, so we can change them per test without reloading the module.

let mock_findOne_TenantStorageConfig = null;
let mock_findOne_Case = null;
let mock_getProviderForTenant = null;
let mock_create_File = null;
let mock_enqueueStorageJob = null;
let mock_safeLogForensicAudit = null;
let mock_findOne_File = null;
let mock_updateOne_File = null;
let mock_updateMany_TenantStorageConfig = null;
let mock_logSecurityAuditEvent = null;
let mock_noteFileDownload = null;

// OVERRIDE the module exports BEFORE files.controller.js requires them.
TenantStorageConfig.findOne = function() { return mock_findOne_TenantStorageConfig.apply(this, arguments); };
TenantStorageConfig.updateMany = function() { return mock_updateMany_TenantStorageConfig.apply(this, arguments); };

Case.findOne = function() { return mock_findOne_Case.apply(this, arguments); };

File.create = function() { return mock_create_File.apply(this, arguments); };
File.findOne = function() { return mock_findOne_File.apply(this, arguments); };
File.updateOne = function() { return mock_updateOne_File.apply(this, arguments); };

StorageProviderFactoryModule.getProviderForTenant = function() { return mock_getProviderForTenant.apply(this, arguments); };

storageQueueModule.enqueueStorageJob = function() { return mock_enqueueStorageJob.apply(this, arguments); };

forensicAuditServiceModule.safeLogForensicAudit = function() { return mock_safeLogForensicAudit.apply(this, arguments); };

securityAuditServiceModule.logSecurityAuditEvent = function() { return mock_logSecurityAuditEvent.apply(this, arguments); };

securityTelemetryServiceModule.noteFileDownload = function() { return mock_noteFileDownload.apply(this, arguments); };


// NOW require the controller
const filesController = require('../src/controllers/files.controller');

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

async function runRequestUploadTests() {
  console.log('Running requestUpload tests...');

  try {
    // 1. Happy Path
    mock_findOne_TenantStorageConfig = () => ({ select: async () => ({ status: 'ACTIVE', provider: 'google_drive' }) });
    mock_findOne_Case = () => ({ select: async () => ({ caseId: 'CASE-123' }) });

    mock_getProviderForTenant = async () => ({
      prefix: 'test-tenant',
      generateUploadUrl: async () => 'https://mock-upload-url.com',
    });

    mock_create_File = async (data) => ({ ...data, _id: { toString: () => 'file-id-123' } });

    let enqueueCalls = 0;
    mock_enqueueStorageJob = async () => { enqueueCalls++; };

    let auditCalled = false;
    mock_safeLogForensicAudit = async () => { auditCalled = true; };

    const req = {
      firmId: '000000000000000000000001',
      user: { _id: 'user-1', role: 'admin' },
      body: { caseId: 'CASE-123', originalName: 'test.pdf', mimeType: 'application/pdf', size: 1024 },
    };
    const res = createMockRes();

    await filesController.requestUpload(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.uploadUrl, 'https://mock-upload-url.com');
    assert.strictEqual(enqueueCalls, 3);
    assert.strictEqual(auditCalled, true);

    // 2. Storage Not Active
    mock_findOne_TenantStorageConfig = () => ({ select: async () => null });
    const resInactive = createMockRes();
    await filesController.requestUpload(req, resInactive);
    assert.strictEqual(resInactive.statusCode, 409);
    assert.strictEqual(resInactive.body.success, false);
    assert.strictEqual(resInactive.body.message, 'Storage is not active for this tenant');

    // 3. Case Not Found
    mock_findOne_TenantStorageConfig = () => ({ select: async () => ({ status: 'ACTIVE', provider: 'google_drive' }) });
    mock_findOne_Case = () => ({ select: async () => null });
    const resNoCase = createMockRes();
    await filesController.requestUpload(req, resNoCase);
    assert.strictEqual(resNoCase.statusCode, 404);
    assert.strictEqual(resNoCase.body.success, false);
    assert.strictEqual(resNoCase.body.message, 'Case not found for tenant');

    console.log('requestUpload tests passed.');
  } finally {
    // clean up mocks conceptually if needed
  }
}

async function runDownloadFileTests() {
  console.log('Running downloadFile tests...');

  try {
    // 1. Happy Path
    mock_findOne_TenantStorageConfig = () => ({ select: async () => ({ status: 'ACTIVE' }) });
    mock_findOne_File = async () => ({ _id: { toString: () => 'file-123' }, caseId: 'CASE-123', objectKey: 'path/to/file', status: 'AVAILABLE' });
    mock_updateOne_File = async () => ({});

    mock_getProviderForTenant = async () => ({
      getFileMetadata: async () => ({ size: 1024 }),
      generateDownloadUrl: async () => 'https://mock-download-url.com',
    });

    mock_safeLogForensicAudit = async () => {};
    mock_logSecurityAuditEvent = async () => {};
    mock_noteFileDownload = async () => {};

    const req = {
      firmId: '000000000000000000000001',
      user: { _id: 'user-1' },
      params: { fileId: 'file-123' },
    };
    const res = createMockRes();

    await filesController.downloadFile(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.downloadUrl, 'https://mock-download-url.com');

    // 2. File Not Found
    mock_findOne_File = async () => null;
    const resNoFile = createMockRes();
    await filesController.downloadFile(req, resNoFile);
    assert.strictEqual(resNoFile.statusCode, 404);
    assert.strictEqual(resNoFile.body.success, false);
    assert.strictEqual(resNoFile.body.message, 'File not found');

    // 3. Provider Error (Missing file)
    mock_findOne_File = async () => ({ _id: { toString: () => 'file-123' }, caseId: 'CASE-123', objectKey: 'path/to/file', status: 'AVAILABLE' });
    mock_getProviderForTenant = async () => ({
      getFileMetadata: async () => { throw { status: 404 }; },
    });

    let fileStatusUpdatedToMissing = false;
    mock_updateOne_File = async (query, update) => {
      if (update.status === 'MISSING') fileStatusUpdatedToMissing = true;
    };

    const resMissing = createMockRes();
    await filesController.downloadFile(req, resMissing);
    assert.strictEqual(resMissing.statusCode, 410);
    assert.strictEqual(resMissing.body.success, false);
    assert.strictEqual(resMissing.body.code, 'FILE_MISSING');
    assert.strictEqual(fileStatusUpdatedToMissing, true);

    // 4. Provider Error (Unauthorized/Quota - Triggers status update)
    mock_getProviderForTenant = async () => ({
      getFileMetadata: async () => { throw { status: 401, message: 'invalid_grant' }; },
    });
    let statusUpdateCalled = false;
    mock_updateMany_TenantStorageConfig = async () => { statusUpdateCalled = true; };

    const resAuthErr = createMockRes();
    await filesController.downloadFile(req, resAuthErr);
    assert.strictEqual(resAuthErr.statusCode, 500);
    assert.strictEqual(statusUpdateCalled, true);

    console.log('downloadFile tests passed.');
  } finally {
  }
}

async function run() {
  try {
    await runRequestUploadTests();
    await runDownloadFileTests();
    console.log('All files.controller.test.js tests passed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Test failure:', error);
    process.exit(1);
  }
}

run();
