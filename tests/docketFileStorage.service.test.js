#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const state = {
  latestVersion: { version: 2 },
  createdPayload: null,
  createdDoc: null,
  uploaded: null,
  downloaded: null,
  attachments: [],
};

const mocks = {
  '../models/Attachment.model': {
    findOne(query) {
      if (query && query._id) {
        return {
          lean: async () => ({ _id: query._id, caseId: 'DCK-1', firmId: 'FIRM-1', storageFileId: 'drv-file-1', fileName: 'doc.pdf', mimeType: 'application/pdf', size: 120, storageProvider: 'google-drive', version: 1, createdAt: new Date('2026-01-01T00:00:00Z') }),
        };
      }
      return {
        sort() {
          return {
            select() {
              return {
                lean: async () => state.latestVersion,
              };
            },
          };
        },
      };
    },
    async create(payload) {
      state.createdPayload = payload;
      const doc = {
        _id: 'att-1',
        ...payload,
        toObject() {
          return { _id: this._id, ...payload };
        },
      };
      state.createdDoc = doc;
      return doc;
    },
    find() {
      return {
        sort() {
          return {
            lean: async () => state.attachments,
          };
        },
      };
    },
  },
  '../models/Case.model': {
    findOne() {
      return {
        select() {
          return {
            lean: async () => ({ _id: 'c1', caseId: 'DCK-1', caseNumber: 'DCK-1', firmId: 'FIRM-1' }),
          };
        },
      };
    },
  },
  './googleDrive.service': {
    googleDriveService: {
      async uploadFile(firmId, file) {
        state.uploaded = { firmId, file };
        return { id: 'drv-file-1', name: 'doc.pdf', mimeType: 'application/pdf', size: 120, webViewLink: 'https://drive/view/1' };
      },
      async downloadFile(firmId, fileId) {
        state.downloaded = { firmId, fileId };
        return 'STREAM';
      },
    },
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.apply(this, arguments);
};

const service = require('../src/services/docketFileStorage.service');

async function run() {
  console.log('Running docketFileStorage.service tests...');
  try {
    const uploaded = await service.uploadFile({
      file: Buffer.from('abc'),
      fileName: 'doc.pdf',
      fileType: 'application/pdf',
      docketId: 'DCK-1',
      firmId: 'FIRM-1',
      uploadedBy: 'X123456',
      uploadedByName: 'Ada',
    });

    assert.strictEqual(uploaded.version, 3);
    assert.strictEqual(state.createdPayload.version, 3);
    assert.strictEqual(state.uploaded.firmId, 'FIRM-1');
    assert.ok(!Object.prototype.hasOwnProperty.call(uploaded, 'storageFileId'));
    console.log('  ✓ uploadFile increments version and hides storage ids');

    const list = await service.listAttachments({ docketId: 'DCK-1', firmId: 'FIRM-1' });
    assert.ok(Array.isArray(list));
    console.log('  ✓ listAttachments returns docket scoped list');

    const download = await service.getFile({ attachmentId: 'att-1', firmId: 'FIRM-1' });
    assert.strictEqual(download.stream, 'STREAM');
    assert.strictEqual(state.downloaded.fileId, 'drv-file-1');
    console.log('  ✓ getFile resolves through googleDriveService.downloadFile');

    console.log('All docketFileStorage.service tests passed.');
  } catch (error) {
    console.error('docketFileStorage.service tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
