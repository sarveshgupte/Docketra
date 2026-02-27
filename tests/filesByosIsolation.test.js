#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let createdFilePayload = null;
let downloadProviderCalls = 0;

const mockCaseModel = {
  findOne: (query) => ({
    select: async () => {
      if (query.firmId === 'tenant-a' && query.$or?.some((v) => v.caseId === 'CASE-1')) {
        return { caseId: 'CASE-1' };
      }
      return null;
    },
  }),
};

const mockFileModel = {
  async create(payload) {
    createdFilePayload = payload;
    return { _id: 'file-123', ...payload };
  },
  async findOne(query) {
    if (query._id === 'file-123' && query.tenantId === 'tenant-a') {
      return {
        _id: 'file-123',
        tenantId: 'tenant-a',
        caseId: 'CASE-1',
        objectKey: 'tenant-a/cases/CASE-1/uuid',
      };
    }
    return null;
  },
};

const mockStorageFactory = {
  async getProviderForTenant(tenantId) {
    return {
      prefix: tenantId,
      async generateUploadUrl() {
        return 'https://upload.example/signed';
      },
      async generateDownloadUrl() {
        downloadProviderCalls += 1;
        return 'https://download.example/signed';
      },
    };
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../models/Case.model') return mockCaseModel;
  if (request === '../models/File.model') return mockFileModel;
  if (request === '../storage/StorageProviderFactory') return mockStorageFactory;
  return originalLoad.apply(this, arguments);
};

const { requestUpload, downloadFile } = require('../src/controllers/files.controller');

function makeRes() {
  return {
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
  };
}

async function testRequestUploadCreatesTenantScopedMetadata() {
  const req = {
    firmId: 'tenant-a',
    user: { _id: 'user-1' },
    body: {
      caseId: 'CASE-1',
      originalName: 'evidence.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    },
  };
  const res = makeRes();

  await requestUpload(req, res);

  assert.strictEqual(res.statusCode, 201, 'Expected successful upload request status');
  assert.strictEqual(createdFilePayload.tenantId, 'tenant-a', 'File metadata must include tenantId');
  assert(createdFilePayload.objectKey.startsWith('tenant-a/cases/CASE-1/'), 'Object key must be tenant/cases/caseId scoped');
  assert.strictEqual(res.body.data.uploadUrl, 'https://upload.example/signed');
}

async function testCrossTenantDownloadRejected() {
  const req = {
    firmId: 'tenant-b',
    user: { _id: 'user-2' },
    params: { fileId: 'file-123' },
  };
  const res = makeRes();

  await downloadFile(req, res);

  assert.strictEqual(res.statusCode, 404, 'Cross-tenant file lookup should be rejected');
  assert.strictEqual(downloadProviderCalls, 0, 'Provider URL generation must not happen for cross-tenant access');
}

async function run() {
  console.log('Running filesByosIsolation tests...');
  try {
    await testRequestUploadCreatesTenantScopedMetadata();
    console.log('  ✓ upload request stores tenant-scoped metadata and object key');
    await testCrossTenantDownloadRejected();
    console.log('  ✓ cross-tenant download access is rejected');
    console.log('All filesByosIsolation tests passed.');
  } catch (error) {
    console.error('filesByosIsolation tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
