#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const calls = [];
const signedUrlCalls = [];

class MockCommand {
  constructor(input) {
    this.input = input;
  }
}

const mockAws = {
  S3Client: class {
    async send(command) {
      calls.push({ type: command.constructor.name, input: command.input });
      if (command.constructor.name === 'GetObjectCommand') return { Body: 'STREAM' };
      if (command.constructor.name === 'ListObjectsV2Command') return { Contents: [] };
      return {};
    }
  },
  PutObjectCommand: class PutObjectCommand extends MockCommand {},
  GetObjectCommand: class GetObjectCommand extends MockCommand {},
  DeleteObjectCommand: class DeleteObjectCommand extends MockCommand {},
  HeadBucketCommand: class HeadBucketCommand extends MockCommand {},
  HeadObjectCommand: class HeadObjectCommand extends MockCommand {},
  ListObjectsV2Command: class ListObjectsV2Command extends MockCommand {},
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@aws-sdk/client-s3') return mockAws;
  if (request === '@aws-sdk/s3-request-presigner') {
    return {
      getSignedUrl: async (client, command) => { // eslint-disable-line no-unused-vars
        signedUrlCalls.push(command.input);
        return 'https://signed';
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

(async () => {
  try {
    const { S3Provider } = require('../src/services/storage/providers/S3Provider');
    const provider = new S3Provider({ tenantId: 't1', bucket: 'bucket', region: 'us-east-1', prefix: 'tenant-a' });

    const uploaded = await provider.uploadFile('backups/nightly', 'file.zip', Buffer.from('x'));
    assert.strictEqual(uploaded.fileId, 'tenant-a/backups/nightly/file.zip');

    await provider.downloadFile(uploaded.fileId);
    const getCall = calls.find((item) => item.type === 'GetObjectCommand');
    assert.strictEqual(getCall.input.Key, uploaded.fileId);

    await provider.generateDownloadUrl(uploaded.fileId);
    assert.strictEqual(signedUrlCalls[0].Key, uploaded.fileId);

    await provider.verifyUploadedObject({ objectKey: uploaded.fileId, expectedSize: 0 });
    const headCall = calls.find((item) => item.type === 'HeadObjectCommand');
    assert.strictEqual(headCall.input.Key, uploaded.fileId);

    const session = await provider.createDirectUploadSession({ objectKey: uploaded.fileId });
    assert.strictEqual(session.objectKey, uploaded.fileId);

    const safeName = await provider.uploadFile(null, 'invoice..final.pdf', Buffer.from('ok'));
    assert.strictEqual(safeName.fileId, 'tenant-a/invoice..final.pdf');

    await assert.rejects(() => provider.downloadFile('../tenant-b/file.zip'), /Invalid object key path/);
    await assert.rejects(() => provider.downloadFile('folder/../file.zip'), /Invalid object key path/);
    await assert.rejects(() => provider.generateDownloadUrl('../tenant-b/file.zip'), /Invalid object key path/);
    await assert.rejects(() => provider.verifyUploadedObject({ objectKey: '../tenant-b/file.zip' }), /Invalid object key path/);
    await assert.rejects(() => provider.createDirectUploadSession({ objectKey: '../tenant-b/file.zip' }), /Invalid object key path/);

    console.log('✓ uploadFile returns tenant-scoped key');
    console.log('✓ downloadFile(uploaded.fileId) does not double-prefix');
    console.log('✓ generateDownloadUrl and verifyUploadedObject use normalized key');
    console.log('✓ createDirectUploadSession scopes key exactly once');
    console.log('✓ object key normalization rejects path traversal attempts');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
})();
