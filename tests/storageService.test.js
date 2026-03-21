#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const state = {
  caseDoc: { caseId: 'CASE-1', firmId: 'FIRM1', drive: {}, storage: {} },
  activeConfig: { firmId: 'FIRM1', isActive: true, rootFolderId: 'root-1' },
  attachmentDoc: { _id: 'att-1', firmId: 'FIRM1', driveFileId: 'drv-1' },
  updatePayload: null,
  folderCalls: [],
};

const mockProvider = {
  async getOrCreateFolder(parentFolderId, folderName) {
    state.folderCalls.push({ parentFolderId, folderName });
    return `${folderName}-id`;
  },
  async uploadFile(folderId, filename) {
    return { fileId: `${folderId}:${filename}` };
  },
  async downloadFile(fileId) {
    return `stream:${fileId}`;
  },
};

const mocks = {
  '../models/Attachment.model': {
    findOne() {
      return {
        lean: async () => state.attachmentDoc,
      };
    },
  },
  '../models/Case.model': {
    findOne() {
      return {
        select() {
          return {
            lean: async () => state.caseDoc,
          };
        },
      };
    },
    async updateOne(_query, payload) { state.updatePayload = payload; },
  },
  '../models/StorageConfiguration.model': {
    findOne() {
      return {
        lean: async () => state.activeConfig,
      };
    },
  },
  '../models/Firm.model': {
    findById() {
      return {
        select() {
          return {
            lean: async () => ({ name: 'Acme Legal' }),
          };
        },
      };
    },
  },
  './storage/StorageProviderFactory': {
    StorageProviderFactory: {
      async getProvider() { return mockProvider; },
    },
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.apply(this, arguments);
};

const storageService = require('../src/services/storage.service');

async function testEnsureCaseFolderExists() {
  state.folderCalls = [];
  const folderId = await storageService.ensureCaseFolderExists('FIRM1', 'CASE-1', mockProvider);
  assert.strictEqual(folderId, 'Attachments-id');
  assert.ok(state.updatePayload.$set['drive.attachmentsFolderId']);
  assert.deepStrictEqual(state.folderCalls, [
    { parentFolderId: 'root-1', folderName: 'Docketra' },
    { parentFolderId: 'Docketra-id', folderName: 'Acme Legal' },
    { parentFolderId: 'Acme Legal-id', folderName: 'Cases' },
    { parentFolderId: 'Cases-id', folderName: 'CASE-1' },
    { parentFolderId: 'CASE-1-id', folderName: 'Attachments' },
  ]);
  console.log('  ✓ ensureCaseFolderExists creates folder hierarchy when missing');
}

async function testUploadCaseAttachment() {
  const result = await storageService.uploadCaseAttachment('FIRM1', 'CASE-1', 'a.txt', Buffer.from('x'));
  assert.ok(result.fileId.includes('a.txt'));
  console.log('  ✓ uploadCaseAttachment dispatches to provider');
}

async function testDownloadFirmScopedAttachment() {
  const result = await storageService.downloadCaseAttachment('FIRM1', 'att-1');
  assert.strictEqual(result, 'stream:drv-1');
  console.log('  ✓ downloadCaseAttachment uses firm-scoped query and provider download');
}

async function run() {
  console.log('Running storageService tests...');
  try {
    await testEnsureCaseFolderExists();
    await testUploadCaseAttachment();
    await testDownloadFirmScopedAttachment();
    console.log('All storageService tests passed.');
  } catch (error) {
    console.error('storageService tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
