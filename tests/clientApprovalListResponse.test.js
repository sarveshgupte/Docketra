#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
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

async function testClientApprovalListResponseContract() {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        find: () => ({
          select() { return this; },
          limit() { return this; },
          skip() { return this; },
          sort: async () => ([{ clientId: 'C000001', businessName: 'Acme Legal', status: 'ACTIVE', isActive: true }]),
        }),
        countDocuments: async () => 1,
      };
    }
    if (request === '../repositories') {
      return {};
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (request === '../config/constants') {
      return {
        CLIENT_STATUS: {
          ACTIVE: 'ACTIVE',
        },
      };
    }
    if (
      request.includes('/models/')
      || request.includes('/repositories/')
      || request.includes('/services/')
      || request.includes('/config/')
      || request.includes('/domain/')
      || request.includes('/middleware/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/clientApproval.controller');
  const { listClients } = require('../src/controllers/clientApproval.controller');
  const res = createRes();

  await listClients({
    query: {},
    user: { firmId: 'firm-1' },
  }, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body.data, [{ clientId: 'C000001', businessName: 'Acme Legal', status: 'ACTIVE', isActive: true }]);
  assert.deepStrictEqual(res.body.clients, res.body.data);
  assert.strictEqual(res.body.total, 1);
  assert.deepStrictEqual(res.body.pagination, {
    page: 1,
    limit: 20,
    total: 1,
    pages: 1,
  });
  console.log('  ✓ client approval list returns the stable client response contract');
}

async function testClientApprovalListNormalizesUnexpectedResults() {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        find: () => ({
          select() { return this; },
          limit() { return this; },
          skip() { return this; },
          sort: async () => null,
        }),
        countDocuments: async () => 0,
      };
    }
    if (request === '../repositories') {
      return {};
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (request === '../config/constants') {
      return {
        CLIENT_STATUS: {
          ACTIVE: 'ACTIVE',
        },
      };
    }
    if (
      request.includes('/models/')
      || request.includes('/repositories/')
      || request.includes('/services/')
      || request.includes('/config/')
      || request.includes('/domain/')
      || request.includes('/middleware/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/clientApproval.controller');
  const { listClients } = require('../src/controllers/clientApproval.controller');
  const res = createRes();

  await listClients({
    query: {},
    user: { firmId: 'firm-1' },
  }, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body.data, []);
  assert.deepStrictEqual(res.body.clients, []);
  assert.strictEqual(res.body.total, 0);
  console.log('  ✓ client approval list normalizes unexpected query results to empty arrays');
}

async function testClientApprovalListLogsStructuredFailures() {
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  try {
    Module._load = function(request, parent, isMain) {
      if (request === '../models/Client.model') {
        return {
          find: () => ({
            select() { return this; },
            limit() { return this; },
            skip() { return this; },
            sort: async () => {
              throw new Error('list failed');
            },
          }),
          countDocuments: async () => 0,
        };
      }
      if (request === '../repositories') {
        return {};
      }
      if (request === '../middleware/wrapWriteHandler') {
        return (fn) => fn;
      }
      if (request === '../config/constants') {
        return {
          CLIENT_STATUS: {
            ACTIVE: 'ACTIVE',
          },
        };
      }
      if (
        request.includes('/models/')
        || request.includes('/repositories/')
        || request.includes('/services/')
        || request.includes('/config/')
        || request.includes('/domain/')
        || request.includes('/middleware/')
      ) {
        return {};
      }
      return originalLoad.apply(this, arguments);
    };

    clearModule('../src/controllers/clientApproval.controller');
    const { listClients } = require('../src/controllers/clientApproval.controller');
    const res = createRes();

    await listClients({
      query: {},
      originalUrl: '/api/admin/clients',
      requestId: 'req-client-approval',
      user: { _id: 'user-1', firmId: 'firm-1' },
    }, res);

    assert.strictEqual(res.statusCode, 500);
    assert.deepStrictEqual(logged[0], ['CLIENT_LIST_ERROR', {
      firmId: 'firm-1',
      requestId: 'req-client-approval',
      userId: 'user-1',
      route: '/api/admin/clients',
      error: 'list failed',
    }]);
    assert.deepStrictEqual(res.body, {
      success: false,
      message: 'Error fetching clients',
    });
    console.log('  ✓ client approval list logs structured failures');
  } finally {
    console.error = originalError;
  }
}

async function run() {
  try {
    await testClientApprovalListResponseContract();
    await testClientApprovalListNormalizesUnexpectedResults();
    await testClientApprovalListLogsStructuredFailures();
    console.log('Client approval list response tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error(error);
  Module._load = originalLoad;
  process.exit(1);
});
