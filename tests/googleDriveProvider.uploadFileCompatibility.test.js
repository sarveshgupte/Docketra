#!/usr/bin/env node
'use strict';

const assert = require('assert');
const GoogleDriveProvider = require('../src/services/storage/providers/GoogleDriveProvider');

(async () => {
  try {
    const calls = [];
    const driveClient = {
      files: {
        async create(payload) {
          calls.push(payload);
          return { data: { id: 'g-1', webViewLink: 'https://drive/file/g-1' } };
        },
        async list(payload) {
          calls.push(payload);
          return { data: { files: [] } };
        },
      },
    };

    const provider = new GoogleDriveProvider({ driveClient });
    await provider.uploadFile(null, 'doc.pdf', Buffer.from('abc'), 'application/pdf');

    assert.strictEqual(calls[0].requestBody.name, 'doc.pdf');
    assert.ok(!Object.prototype.hasOwnProperty.call(calls[0].requestBody, 'parents'));
    assert.strictEqual(typeof calls[0].media.body.pipe, 'function');

    await provider.uploadFile('folder-1', 'doc2.pdf', Buffer.from('xyz'), 'application/pdf');
    assert.deepStrictEqual(calls[1].requestBody.parents, ['folder-1']);
    await provider.uploadFile('folder-2', 'doc3.pdf', require('stream').Readable.from(Buffer.from('123')), 'application/pdf'); // eslint-disable-line global-require
    assert.strictEqual(typeof calls[2].media.body.pipe, 'function');

    await provider.listFiles(null);
    assert.strictEqual(calls[3].q, `'root' in parents and trashed = false`);

    await provider.createDirectUploadSession({ fileName: 'direct.txt', mimeType: 'text/plain', folderId: null });
    assert.ok(!Object.prototype.hasOwnProperty.call(calls[4].requestBody, 'parents'));

    console.log('✓ GoogleDriveProvider uploadFile omits null parents');
    console.log('✓ GoogleDriveProvider uploadFile accepts Buffer input');
    console.log('✓ GoogleDriveProvider listFiles(null) resolves to root query');
    console.log('✓ GoogleDriveProvider direct upload omits null parents');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
