#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const state = {
  caseFiles: [],
  attachments: [],
  providerMode: 'connected',
  verifyResult: { ok: true, provider: 'google-drive', fileId: 'drv-1', webViewLink: 'https://view' },
};

const mockProvider = {
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
    return state.verifyResult;
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
  },
  '../models/Attachment.model': {
    findOne() {
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
        return mockProvider;
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
        return { ok: true, provider: 's3', fileId: 'managed-key' };
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
      user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
    });
    assert.strictEqual(attachment.storageFileId, 'drv-1');
    assert.strictEqual(state.caseFiles[0].uploadStatus, 'verified');

    let mismatchRejected = false;
    try {
      await directUploadService.finalizeIntent({
        uploadId: intent.uploadId,
        firmId: 'FIRM-1',
        completion: { providerFileId: 'wrong' },
        user: { xID: 'X123', email: 'a@b.com', name: 'Ada' },
      });
    } catch (error) {
      mismatchRejected = error.code === 'UPLOAD_IDENTIFIER_MISMATCH' || error.status === 409;
    }
    assert.ok(mismatchRejected, 'mismatched completion metadata should be rejected');

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

    console.log('directUpload.service test passed');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
})();
