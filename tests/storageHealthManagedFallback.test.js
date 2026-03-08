#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore
  }
};

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

async function run() {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/TenantStorageConfig.model') {
      return {
        findOne: () => ({
          select: () => ({
            lean: async () => null,
          }),
        }),
      };
    }
    if (request === '../models/TenantStorageHealth.model') {
      return {
        findOne: () => ({
          select: () => ({
            lean: async () => null,
          }),
        }),
      };
    }
    if (request === '../models/Firm.model') {
      return {
        findById: () => ({
          select: () => ({
            lean: async () => ({
              storage: { mode: 'docketra_managed', provider: null },
            }),
          }),
        }),
      };
    }
    if (request === 'googleapis') {
      return { google: {} };
    }
    if (
      request.includes('/storage/')
      || request.includes('/services/')
      || request.includes('/utils/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/storage.controller');
  const { getStorageHealth } = require('../src/controllers/storage.controller');

  const res = createRes();
  await getStorageHealth({ firmId: '507f1f77bcf86cd799439011' }, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {
    status: 'HEALTHY',
    lastVerifiedAt: null,
    missingFilesCount: 0,
    sampleSize: 0,
    lastError: null,
  });
  console.log('✓ storage health defaults to healthy for Docketra-managed storage');

  Module._load = originalLoad;
}

run().catch((error) => {
  Module._load = originalLoad;
  console.error(error);
  process.exit(1);
});
