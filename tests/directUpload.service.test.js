#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const state = {
  caseFiles: [],
  attachments: [],
  providerMode: 'connected',
  connectedVerifyResult: { ok: true, provider: 'google-drive', fileId: 'drv-1', webViewLink: 'https://view', checksum: { raw: 'md5:abc123', algorithm: 'md5', value: 'abc123' } },
  fallbackVerifyResult: { ok: true, provider: 's3', fileId: 'managed-key', checksum: { raw: 'md5:def456', algorithm: 'md5', value: 'def456' } },
};

const connectedProvider = {
  providerName: 'google-drive',
  async createDirectUploadSession() {
    return {
      provider: 'google-drive',
      uploadUrl: 'https://upload.example',
      method: 'PUT',
      headers: {},
      providerFileId: 'drv-1',
      objectKey: null,
    };
  },
  async verifyUploadedObject() {
    return state.connectedVerifyResult;
  },
};

const mocks = {
  '../models/CaseFile.model': {
    async create(payload) {
      const doc = {
        _id: `upload-${state.caseFiles.length + 1}`,
        ...payload,
        async save() { return this; },
      };
      state.caseFiles.push(doc);
      return doc;
    },
    async findOne(query) {
      return state.caseFiles.find((row) => String(row._id) === String(query._id) && String(row.firmId) === String(query.firmId)) || null;
    },
    async findOneAndUpdate(query, update) {
      const row = state.caseFiles.find((item) => (
        String(item._id) === String(query._id)
        && String(item.firmId) === String(query.firmId)
        && item.uploadStatus === query.uploadStatus
      ));
      if (!row) return null;
      Object.assign(row, update?.$set || {});
      return row;
    },
  },
  '../models/Attachment.model': {
    async findById(id) {
      return state.attachments.find((row) => String(row._id) === String(id)) || null;
    },
    findOne(query = {}) {
      if (query._id) {
        return state.attachments.find(
          (row) => String(row._id) === String(query._id) && String(row.firmId) === String(query.firmId)
        ) || null;
      }
      return { sort: () => ({ select: () => ({ lean: async () => null }) }) };
    },
    async create(payload) {
      const doc = { _id: `att-${state.attachments.length + 1}`, ...payload };
      state.attachments.push(doc);
      return doc;
    },
  },
  '../repositories': {
    CaseRepository: {
      async findByCaseId() {
        return {
          caseId: 'DCK-1',
          drive: { attachmentsFolderId: 'folder-1' },
        };
      },
    },
    ClientRepository: {
      async findByClientId() {
        return { clientId: 'C0001', drive: { documentsFolderId: 'folder-client' }, async save() { return this; } };
      },
    },
  },
  './cfsDrive.service': {
    getFolderIdForFileType() { return 'folder-1'; },
    async validateClientCFSMetadata() { return true; },
    getClientFolderIdForFileType() { return 'folder-client'; },
  },
  './storage/StorageProviderFactory': {
    StorageProviderFactory: {
      async getProvider() {
        if (state.providerMode === 'fallback') {
          throw new Error('no firm-connected provider');
        }
        return connectedProvider;
      },
    },
  },
  './storage/providers/S3Provider': {
    S3Provider: class MockS3Provider {
      constructor() {
        this.providerName = 's3';
      }
      async createDirectUploadSession({ objectKey }) {
        return { provider: 's3', uploadUrl: 'https://s3-upload', method: 'PUT', headers: {}, objectKey, providerFileId: null };
      }
      async verifyUploadedObject() {
        return state.fallbackVerifyResult;
      }
    },
  },
  '@aws-sdk/client-s3': {
    S3Client: class MockS3Client {},
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.apply(this, arguments);
};

const directUploadService = require('../src/services/directUpload.service');

(async () => {
  try {
    process.env.MANAGED_STORAGE_S3_BUCKET = 'bucket';
    process.env.MANAGED_STORAGE_S3_REGION = 'us-east-1';

    const intent = await directUploadService.createIntent({
      firmId: 'FIRM-1',
      caseId: 'DCK-1',
      source: 'upload',
      fileName: 'evidence.pdf',
      mimeType: 'application/pdf',
      size: 1200,
      description: 'evidence',
      checksum: 'md5:abc123',
      role: 'admin',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });

    assert.ok(intent.uploadUrl);
    assert.strictEqual(state.caseFiles[0].uploadStatus, 'initiated');
    assert.strictEqual(state.caseFiles[0].localPath, undefined);

    const attachment = await directUploadService.finalizeIntent({
      uploadId: intent.uploadId,
      firmId: 'FIRM-1',
      completion: { providerFileId: 'drv-1' },
      checksum: 'md5:abc123',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    assert.strictEqual(attachment.storageFileId, 'drv-1');
    assert.strictEqual(state.caseFiles[0].uploadStatus, 'verified');

    let mismatchRejected = false;
    const mismatchIntent = await directUploadService.createIntent({
      firmId: 'FIRM-1',
      caseId: 'DCK-1',
      source: 'upload',
      fileName: 'mismatch.pdf',
      mimeType: 'application/pdf',
      size: 1000,
      description: 'mismatch',
      role: 'admin',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    try {
      await directUploadService.finalizeIntent({
        uploadId: mismatchIntent.uploadId,
        firmId: 'FIRM-1',
        completion: { providerFileId: 'wrong' },
        user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
      });
    } catch (error) {
      mismatchRejected = error.code === 'UPLOAD_IDENTIFIER_MISMATCH' || error.status === 409;
    }
    assert.ok(mismatchRejected, 'mismatched completion metadata should be rejected');

    let checksumMismatchRejected = false;
    const checksumIntent = await directUploadService.createIntent({
      firmId: 'FIRM-1',
      caseId: 'DCK-1',
      source: 'upload',
      fileName: 'checksum.pdf',
      mimeType: 'application/pdf',
      size: 1200,
      description: 'checksum',
      checksum: 'md5:abc123',
      role: 'admin',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    try {
      await directUploadService.finalizeIntent({
        uploadId: checksumIntent.uploadId,
        firmId: 'FIRM-1',
        completion: { providerFileId: 'drv-1' },
        checksum: 'md5:xxxxxx',
        user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
      });
    } catch (error) {
      checksumMismatchRejected = error.code === 'UPLOAD_CHECKSUM_MISMATCH';
    }
    assert.ok(checksumMismatchRejected, 'checksum mismatches should be rejected');

    const expiringIntent = await directUploadService.createIntent({
      firmId: 'FIRM-1',
      caseId: 'DCK-1',
      source: 'upload',
      fileName: 'late.pdf',
      mimeType: 'application/pdf',
      size: 1400,
      description: 'late',
      role: 'admin',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    const expiringSession = state.caseFiles.find((row) => String(row._id) === expiringIntent.uploadId);
    expiringSession.expiresAt = new Date(Date.now() - 1000);

    let expired = false;
    try {
      await directUploadService.finalizeIntent({
        uploadId: expiringIntent.uploadId,
        firmId: 'FIRM-1',
        completion: {},
        user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
      });
    } catch (error) {
      expired = error.code === 'UPLOAD_SESSION_EXPIRED';
    }
    assert.ok(expired, 'expired sessions should be marked abandoned and rejected');

    state.providerMode = 'fallback';
    const fallbackIntent = await directUploadService.createIntent({
      firmId: 'FIRM-1',
      clientId: 'C0001',
      source: 'client_cfs',
      fileName: 'fallback.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      description: 'fallback',
      role: 'admin',
      fileType: 'documents',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    assert.strictEqual(fallbackIntent.provider, 's3');
    assert.strictEqual(fallbackIntent.providerMode, 'managed_fallback');

    state.providerMode = 'connected';
    const fallbackAttachment = await directUploadService.finalizeIntent({
      uploadId: fallbackIntent.uploadId,
      firmId: 'FIRM-1',
      completion: { objectKey: fallbackIntent.objectKey },
      checksum: 'md5:def456',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    assert.strictEqual(fallbackAttachment.storageProvider, 's3', 'finalize should honor session backend');

    const firstFinalize = await directUploadService.finalizeIntent({
      uploadId: intent.uploadId,
      firmId: 'FIRM-1',
      completion: { providerFileId: 'drv-1' },
      checksum: 'md5:abc123',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    const secondFinalize = await directUploadService.finalizeIntent({
      uploadId: intent.uploadId,
      firmId: 'FIRM-1',
      completion: { providerFileId: 'drv-1' },
      checksum: 'md5:abc123',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    assert.strictEqual(String(firstFinalize._id), String(secondFinalize._id), 'finalize should be idempotent');
    assert.strictEqual(
      state.attachments.filter((item) => item.fileName === 'evidence.pdf').length,
      1,
      'idempotent finalize should not create duplicate attachments'
    );

    const inProgressIntent = await directUploadService.createIntent({
      firmId: 'FIRM-1',
      caseId: 'DCK-1',
      source: 'upload',
      fileName: 'in-progress.pdf',
      mimeType: 'application/pdf',
      size: 1200,
      description: 'in progress',
      role: 'admin',
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    const inProgressSession = state.caseFiles.find((row) => String(row._id) === inProgressIntent.uploadId);
    inProgressSession.uploadStatus = 'uploaded';
    let inProgressRejected = false;
    try {
      await directUploadService.finalizeIntent({
        uploadId: inProgressIntent.uploadId,
        firmId: 'FIRM-1',
        completion: { providerFileId: 'drv-1' },
        user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
      });
    } catch (error) {
      inProgressRejected = error.code === 'UPLOAD_SESSION_IN_PROGRESS';
    }
    assert.ok(inProgressRejected, 'finalize retries should fail while another finalize is in progress');
    assert.strictEqual(
      state.attachments.filter((item) => item.fileName === 'in-progress.pdf').length,
      0,
      'in-progress finalize retries should not create attachments'
    );

    const { computeCleanupAtForStatus } = directUploadService;
    assert.strictEqual(computeCleanupAtForStatus('initiated'), null, 'initiated sessions should not get cleanup ttl');
    assert.ok(computeCleanupAtForStatus('failed') instanceof Date, 'terminal sessions should get cleanup ttl');

    console.log('directUpload.service test passed');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
})();
