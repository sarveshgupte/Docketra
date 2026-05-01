#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const state = {
  firm: { storage: { mode: 'docketra_managed' }, storageConfig: null },
  providerBehavior: 'ok',
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../../models/Firm.model' || request === '../src/models/Firm.model') {
    return { findById: () => ({ select: () => ({ lean: async () => state.firm }) }) };
  }
  if (request === '../services/storage/StorageProviderFactory') {
    return {
      StorageProviderFactory: {
        async getProvider() {
          if (state.providerBehavior === 'bad') {
            const err = new Error('internal aws error: bucket missing');
            err.code = 'MANAGED_STORAGE_NOT_CONFIGURED';
            throw err;
          }
          return {
            providerName: 'docketra_managed',
            async testConnection() { return { ok: true }; },
          };
        },
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

(async () => {
  try {
    const { StorageProviderFactory } = require('../src/services/storage/StorageProviderFactory');

    process.env.MANAGED_STORAGE_S3_BUCKET = 'bucket';
    process.env.MANAGED_STORAGE_S3_REGION = 'us-east-1';

    let provider = await StorageProviderFactory.getProvider('FIRM1');
    assert.strictEqual(provider.providerName, 'docketra_managed');

    delete process.env.MANAGED_STORAGE_S3_BUCKET;
    let threw = false;
    try { await StorageProviderFactory.getProvider('FIRM1'); } catch (e) { threw = e.code === 'MANAGED_STORAGE_NOT_CONFIGURED'; }
    assert.ok(threw);

    const middleware = require('../src/middleware/requireStorageConnected');
    assert.strictEqual(middleware.requireStorageConnected, middleware.requireActiveStorageProvider);

    const req = { firmId: 'FIRM1' };
    const res = { statusCode: 200, body: null, status(c){ this.statusCode = c; return this; }, json(p){ this.body = p; return this; } };
    let nextCalled = false;
    await middleware.requireActiveStorageProvider(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.strictEqual(req.storageContext.providerName, 'docketra_managed');
    assert.strictEqual(req.storageContext.managed, true);
    assert.strictEqual(req.storageContext.firmConnected, false);

    state.providerBehavior = 'bad';
    const reqFail = { firmId: 'FIRM1' };
    const resFail = { statusCode: 200, body: null, status(c){ this.statusCode = c; return this; }, json(p){ this.body = p; return this; } };
    await middleware.requireActiveStorageProvider(reqFail, resFail, () => {});
    assert.strictEqual(resFail.statusCode, 400);
    assert.strictEqual(resFail.body.code, 'STORAGE_NOT_CONNECTED');
    assert.strictEqual(resFail.body.message, 'Managed storage is not configured');

    console.log('storageManagedProviderRuntime tests passed.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
})();
