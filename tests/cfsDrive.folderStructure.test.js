#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');

const calls = [];
const provider = {
  async getOrCreateFolder(parentFolderId, folderName) {
    calls.push({ parentFolderId, folderName });
    return `${parentFolderId || 'root'}/${folderName}`;
  },
};

const mocks = {
  '../models/Attachment.model': {},
  '../models/CaseFile.model': {},
  './storage/StorageProviderFactory': { StorageProviderFactory: {} },
  './storage/storageQueue.service': { enqueueStorageJob: async () => {} },
  '../workers/storage.worker': { JOB_TYPES: {} },
  './softDelete.service': { softDelete: async () => {} },
  '../utils/log': { info: () => {}, error: () => {} },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.apply(this, arguments);
};
const cfsDriveService = require('../src/services/cfsDrive.service');

(async () => {
  try {
    const result = await cfsDriveService.createClientCFSFolderStructure('F001', 'C000001', provider);
    assert.ok(result.documentsFolderId);
    const path = calls.map((c) => `${c.parentFolderId || 'ROOT'}>${c.folderName}`);
    assert.ok(path.includes('ROOT>firm_F001'));
    assert.ok(path.includes('root/firm_F001>client_C000001'));
    assert.ok(path.includes('root/firm_F001/client_C000001>cfs'));
    assert.ok(path.includes('root/firm_F001/client_C000001/cfs>documents'));
    console.log('cfsDrive.folderStructure.test.js passed');
  } finally {
    Module._load = originalLoad;
  }
})();
