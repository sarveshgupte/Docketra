#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore missing cache entry
  }
}

function createRes() {
  return {
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
  };
}

async function testDecryptReturnsNullAndLogsStructuredContext() {
  clearModule('../src/security/encryption.service');

  const originalProvider = process.env.ENCRYPTION_PROVIDER;
  const originalConsoleError = console.error;
  const capturedLogs = [];

  process.env.ENCRYPTION_PROVIDER = 'local';

  Module._load = function(request, parent, isMain) {
    if (
      parent
      && parent.filename.endsWith('/src/security/encryption.service.js')
      && request === './encryption.local.provider'
    ) {
      return class StubLocalEncryptionProvider {
        async decrypt() {
          throw new Error('Unsupported state or unable to authenticate data');
        }
      };
    }

    if (
      parent
      && parent.filename.endsWith('/src/security/encryption.service.js')
      && request === './encryption.kms.provider'
    ) {
      return class StubKmsEncryptionProvider {};
    }

    return originalLoad.apply(this, arguments);
  };

  console.error = (...args) => {
    capturedLogs.push(args);
  };

  try {
    const { decrypt, _resetProvider } = require('../src/security/encryption.service');
    _resetProvider();

    const result = await decrypt('YWJj:ZGVm:Z2hp', 'tenant-1', undefined, {
      logContext: {
        field: 'businessEmail',
        route: '/api/admin/clients',
      },
    });

    assert.strictEqual(result, null, 'decrypt should fail softly and return null');
    assert.strictEqual(capturedLogs.length, 1, 'decrypt should emit one structured error log');
    assert.strictEqual(capturedLogs[0][0], 'TENANT_DECRYPTION_FAILED');
    assert.deepStrictEqual(capturedLogs[0][1], {
      tenantId: 'tenant-1',
      field: 'businessEmail',
      route: '/api/admin/clients',
      model: null,
      error: 'Unsupported state or unable to authenticate data',
    });
  } finally {
    Module._load = originalLoad;
    console.error = originalConsoleError;
    clearModule('../src/security/encryption.service');
    if (originalProvider !== undefined) {
      process.env.ENCRYPTION_PROVIDER = originalProvider;
    } else {
      delete process.env.ENCRYPTION_PROVIDER;
    }
  }

  console.log('✓ decrypt fails softly and logs structured tenant context');
}

async function testClientApprovalListUsesLeanQuery() {
  clearModule('../src/controllers/clientApproval.controller');

  let leanCalled = false;
  let capturedQuery = null;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        find(query) {
          capturedQuery = query;
          return {
            select() { return this; },
            limit() { return this; },
            skip() { return this; },
            sort() { return this; },
            lean: async () => {
              leanCalled = true;
              return [{
                clientId: 'C000001',
                businessName: 'Acme Legal',
                status: 'ACTIVE',
                isActive: true,
              }];
            },
          };
        },
        countDocuments: async () => 1,
      };
    }

    if (request === '../config/constants') {
      return { CLIENT_STATUS: { ACTIVE: 'ACTIVE' }, CASE_CATEGORIES: {} };
    }

    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }

    if (
      request === '../repositories'
      || request === '../models/Case.model'
      || request === '../models/Comment.model'
      || request === '../models/CaseHistory.model'
      || request === '../domain/case/caseStatus'
      || request === '../services/case.service'
    ) {
      return {};
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    const { listClients } = require('../src/controllers/clientApproval.controller');
    const res = createRes();

    await listClients({
      query: { page: '1', limit: '20' },
      user: { firmId: 'firm-1' },
      headers: {},
      originalUrl: '/api/client-approval/clients',
    }, res);

    assert.strictEqual(leanCalled, true, 'client list query should use lean()');
    assert.deepStrictEqual(capturedQuery, {
      firmId: 'firm-1',
      status: 'ACTIVE',
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.clients[0].businessName, 'Acme Legal');
  } finally {
    Module._load = originalLoad;
    clearModule('../src/controllers/clientApproval.controller');
  }

  console.log('✓ admin client list uses lean() and returns stable JSON');
}

async function run() {
  await testDecryptReturnsNullAndLogsStructuredContext();
  await testClientApprovalListUsesLeanQuery();
  console.log('encryptionResilience tests passed.');
}

run().catch((error) => {
  console.error('encryptionResilience tests failed:', error);
  process.exit(1);
});
