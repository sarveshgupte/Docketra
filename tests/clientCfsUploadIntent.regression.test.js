#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const Module = require('module');

process.env.NODE_ENV = 'test';

const controllerPath = require.resolve('../src/controllers/client.controller');

const baseIntent = {
  uploadId: 'upload-123',
  provider: 'google-drive',
  uploadUrl: 'https://upload.example.test/session/abc',
  uploadMethod: 'PUT',
  uploadHeaders: { 'Content-Type': 'application/pdf' },
  objectKey: 'client-cfs/C000001/upload-123/file.pdf',
  providerFileId: 'provider-file-1',
  constraints: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 26214400,
  },
};

const runScenario = async ({ providerMode }) => {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(requestPath, parent, isMain) {
    if (requestPath === '../services/directUpload.service') {
      return {
        createIntent: async () => ({ ...baseIntent, providerMode }),
        isDirectUploadsEnabled: () => true,
      };
    }
    if (requestPath === '../services/featureFlags.service') {
      return { areFileUploadsDisabled: () => false };
    }
    return originalLoad.call(this, requestPath, parent, isMain);
  };

  delete require.cache[controllerPath];
  const { createClientCFSUploadIntent } = require('../src/controllers/client.controller');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.skipTransaction = true;
    req.user = { firmId: '507f1f77bcf86cd799439011', xID: 'U1001', role: 'PRIMARY_ADMIN' };
    next();
  });
  app.post('/api/clients/:clientId/cfs/files/upload-intent', createClientCFSUploadIntent);

  const res = await request(app)
    .post('/api/clients/C000001/cfs/files/upload-intent')
    .send({
      fileName: 'sample.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      fileType: 'documents',
    });

  Module._load = originalLoad;
  delete require.cache[controllerPath];

  assert.ok([200, 201].includes(res.status), `expected success status, got ${res.status}`);
  assert.strictEqual(res.body.success, true, 'success should be true');
  assert.ok(res.body.data, 'response should include intent data');

  const data = res.body.data;
  ['uploadId', 'uploadUrl', 'uploadMethod', 'uploadHeaders', 'providerMode'].forEach((field) => {
    assert.ok(Object.prototype.hasOwnProperty.call(data, field), `intent should include ${field}`);
  });

  ['refreshToken', 'accessToken', 'rootFolderId', 'driveId', 'privateKey'].forEach((secretField) => {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(data, secretField), false, `intent must not expose ${secretField}`);
  });

  const responseText = JSON.stringify(res.body);
  assert.strictEqual(responseText.includes('next is not a function'), false, 'response should not leak next() wrapper crash');
};

const runFailureScenario = async ({ withNextParam }) => {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(requestPath, parent, isMain) {
    if (requestPath === '../services/directUpload.service') {
      return {
        createIntent: async () => {
          const err = new Error('No active storage backend available');
          err.status = 503;
          err.code = 'STORAGE_NOT_AVAILABLE';
          throw err;
        },
        isDirectUploadsEnabled: () => true,
      };
    }
    if (requestPath === '../services/featureFlags.service') {
      return { areFileUploadsDisabled: () => false };
    }
    return originalLoad.call(this, requestPath, parent, isMain);
  };

  delete require.cache[controllerPath];
  const controllerModule = require('../src/controllers/client.controller');
  const targetHandler = withNextParam
    ? controllerModule.createClientCFSUploadIntent
    : (req, res) => controllerModule.createClientCFSUploadIntent(req, res);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.skipTransaction = true;
    req.user = { firmId: '507f1f77bcf86cd799439011', xID: 'U1001', role: 'PRIMARY_ADMIN' };
    next();
  });
  app.post('/api/clients/:clientId/cfs/files/upload-intent', targetHandler);

  const res = await request(app)
    .post('/api/clients/C000001/cfs/files/upload-intent')
    .send({ fileName: 'sample.pdf', mimeType: 'application/pdf', size: 1024, fileType: 'documents' });

  Module._load = originalLoad;
  delete require.cache[controllerPath];

  assert.strictEqual(res.status, 503, `expected 503 status, got ${res.status}`);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, 'STORAGE_NOT_AVAILABLE');
  assert.strictEqual(
    res.body.message,
    'Client fact sheet storage is not available right now. Please try again or check Storage Settings.',
  );
  assert.strictEqual(JSON.stringify(res.body).includes('next is not a function'), false);
};

(async () => {
  await runScenario({ providerMode: 'firm_connected' });
  await runScenario({ providerMode: 'managed_fallback' });
  await runFailureScenario({ withNextParam: true });
  await runFailureScenario({ withNextParam: false });
  console.log('clientCfsUploadIntent.regression.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
