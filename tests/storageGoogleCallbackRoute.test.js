#!/usr/bin/env node
'use strict';

const assert = require('assert');
const express = require('express');
const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);

const storageControllerPath = require.resolve('../src/controllers/storage.controller');
const rbacPath = require.resolve('../src/middleware/rbac.middleware');
const oauthLimiterPath = require.resolve('../src/services/storage/middleware/oauthLimiter');
const requestValidationPath = require.resolve('../src/middleware/requestValidation.middleware');
const schemaPath = require.resolve('../src/schemas/storage.routes.schema');
const requireStorageConnectedPath = require.resolve('../src/middleware/requireStorageConnected');

const originalStorageController = require.cache[storageControllerPath];
const originalRbac = require.cache[rbacPath];
const originalOAuthLimiter = require.cache[oauthLimiterPath];
const originalRequestValidation = require.cache[requestValidationPath];
const originalSchema = require.cache[schemaPath];
const originalRequireStorageConnected = require.cache[requireStorageConnectedPath];

function stub(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
}

(async () => {
  try {
    let callbackCalls = 0;
    let connectCalls = 0;

    stub(storageControllerPath, {
      getStorageStatus: (_req, res) => res.status(200).json({ ok: true }),
      getStorageHealth: (_req, res) => res.status(200).json({ ok: true }),
      googleConnect: (_req, res) => { connectCalls += 1; return res.redirect('https://accounts.google.com/o/oauth2/v2/auth'); },
      googleCallback: (req, res) => {
        callbackCalls += 1;
        if (!req.user) return res.redirect('https://app.example.com/storage/success?reason=session_missing');
        return res.redirect('https://app.example.com/app/firm/acme/storage-settings?provider=google-drive&connected=1');
      },
      googleConfirmDrive: (_req, res) => res.status(200).json({ ok: true }),
      getStorageConfiguration: (_req, res) => res.status(200).json({ ok: true }),
      getStorageOwnershipSummary: (_req, res) => res.status(200).json({ ok: true }),
      getStorageFolderLink: (_req, res) => res.status(200).json({ ok: true }),
      testStorageConnection: (_req, res) => res.status(200).json({ ok: true }),
      exportFirmStorage: (_req, res) => res.status(200).json({ ok: true }),
      downloadFirmStorageExport: (_req, res) => res.status(200).json({ ok: true }),
      listBackupRuns: (_req, res) => res.status(200).json({ ok: true }),
      disconnectStorage: (_req, res) => res.status(200).json({ ok: true }),
      storageHealthCheck: (_req, res) => res.status(200).json({ ok: true }),
      storageUsage: (_req, res) => res.status(200).json({ ok: true }),
      getStorageDataMap: (_req, res) => res.status(200).json({ ok: true }),
    });

    stub(rbacPath, {
      requirePrimaryAdmin: (req, res, next) => {
        if (!req.headers['x-auth']) return res.status(403).json({ error: 'forbidden' });
        req.user = { role: 'PRIMARY_ADMIN' };
        return next();
      },
    });

    stub(oauthLimiterPath, { oauthLimiter: (_req, _res, next) => next() });
    stub(requestValidationPath, { applyRouteValidation: (router) => router });
    stub(schemaPath, {});
    stub(requireStorageConnectedPath, { requireStorageConnected: (_req, _res, next) => next() });

    const router = require('../src/routes/storage.routes');
    const app = express();
    app.use((req, _res, next) => {
      if (req.headers['x-auth']) req.user = { role: 'PRIMARY_ADMIN' };
      return next();
    });
    app.use('/api/storage', router);

    const missingSession = await request(app).get('/api/storage/google/callback?code=abc&state=s1').expect(302);
    assert.ok(missingSession.headers.location.includes('reason=session_missing'));
    assert.ok(!missingSession.text.includes('forbidden'));

    const validSession = await request(app).get('/api/storage/google/callback?code=abc&state=s1').set('x-auth', '1').expect(302);
    assert.ok(validSession.headers.location.includes('connected=1'));

    const connectMissingSession = await request(app).get('/api/storage/google/connect').expect(403);
    assert.strictEqual(connectCalls, 0, 'connect should remain blocked by requirePrimaryAdmin');
    assert.strictEqual(callbackCalls >= 2, true, 'callback should be reached both unauthenticated and authenticated');

    console.log('storageGoogleCallbackRoute.test.js passed');
  } finally {
    const restore = (modulePath, original) => {
      delete require.cache[modulePath];
      if (original) require.cache[modulePath] = original;
    };
    restore(storageControllerPath, originalStorageController);
    restore(rbacPath, originalRbac);
    restore(oauthLimiterPath, originalOAuthLimiter);
    restore(requestValidationPath, originalRequestValidation);
    restore(schemaPath, originalSchema);
    restore(requireStorageConnectedPath, originalRequireStorageConnected);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
