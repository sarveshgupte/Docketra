#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache miss
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

const baseCase = {
  caseId: 'CASE-1001',
  caseCategory: 'CLIENT_NEW',
  status: 'SUBMITTED',
  payload: {
    clientData: {
      businessName: 'Acme Legal LLP',
      primaryContactNumber: '9999999999',
      businessEmail: 'ops@acme.test',
      PAN: 'ABCDE1234F',
    },
  },
};

function createRequest() {
  return {
    params: { caseId: 'CASE-1001' },
    body: { comment: 'Approved after review', approverEmail: 'admin@firm.test' },
    approverEmail: 'admin@firm.test',
    approverUser: { xID: 'X-ADMIN-1' },
    user: { firmId: 'firm-1', role: 'Admin' },
  };
}

async function testApprovalGeneratesClientIdAndReturnsUsableClient() {
  const calls = {
    generateNextClientId: 0,
    createPayload: null,
    persistedInput: null,
    updateStatus: 0,
    comments: 0,
    history: [],
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../repositories') {
      return {
        CaseRepository: {
          findByCaseId: async () => baseCase,
        },
        ClientRepository: {
          create: async (payload) => {
            calls.createPayload = payload;
            return { _id: 'mongo-1', clientId: payload.clientId, deleteOne: async () => {} };
          },
        },
      };
    }
    if (request === '../services/clientIdGenerator') {
      return {
        generateNextClientId: async () => {
          calls.generateNextClientId += 1;
          return 'C123456';
        },
      };
    }
    if (request === '../services/clientProfileWriteGuard.service') {
      return {
        persistClientProfileOrRollback: async ({ profileInput }) => {
          calls.persistedInput = profileInput;
        },
      };
    }
    if (request === '../services/case.service') {
      return {
        updateStatus: async () => {
          calls.updateStatus += 1;
        },
      };
    }
    if (request === '../models/Comment.model') {
      return { create: async () => { calls.comments += 1; } };
    }
    if (request === '../models/CaseHistory.model') {
      return { create: async (payload) => { calls.history.push(payload); } };
    }
    if (request === '../config/constants') {
      return {
        CASE_CATEGORIES: { CLIENT_NEW: 'CLIENT_NEW' },
        CLIENT_STATUS: { ACTIVE: 'ACTIVE' },
      };
    }
    if (request === '../domain/case/caseStatus') {
      return {
        SUBMITTED: 'SUBMITTED',
        UNDER_REVIEW: 'UNDER_REVIEW',
        REVIEWED: 'REVIEWED',
        APPROVED: 'APPROVED',
      };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (request === '../utils/clientStatus') {
      return {
        CANONICAL_CLIENT_STATUSES: { ACTIVE: 'ACTIVE' },
        buildClientStatusQuery: () => ({ $in: ['ACTIVE'] }),
      };
    }
    if (
      request.includes('/models/')
      || request.includes('/services/')
      || request.includes('/utils/')
      || request.includes('/middleware/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/clientApproval.controller');
  const { approveNewClient } = require('../src/controllers/clientApproval.controller');
  const req = createRequest();
  const res = createRes();

  await approveNewClient(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.generateNextClientId, 1, 'approval flow must generate clientId explicitly');
  assert.strictEqual(calls.createPayload.clientId, 'C123456', 'clientId must be passed to repository create');
  assert.strictEqual(calls.updateStatus, 1, 'case status should be updated on success');
  assert.strictEqual(calls.comments, 1, 'approval comment should be written');
  assert.ok(calls.persistedInput, 'profile payload should be written via shared helper');
  assert.strictEqual(res.body.data.client.clientId, 'C123456', 'created client should be immediately usable downstream');
  assert.ok(calls.history.some((entry) => String(entry.description || '').includes('C123456')), 'audit trail should include generated clientId');
  console.log('  ✓ approve-new generates clientId and returns downstream-usable client');
}

async function testApprovalRollsBackOnProfileFailure() {
  let rollbackDeleteCalled = false;
  let updateStatusCalled = false;

  Module._load = function(request, parent, isMain) {
    if (request === '../repositories') {
      return {
        CaseRepository: {
          findByCaseId: async () => baseCase,
        },
        ClientRepository: {
          create: async () => ({
            _id: 'mongo-2',
            clientId: 'C888888',
            deleteOne: async () => {
              rollbackDeleteCalled = true;
            },
          }),
        },
      };
    }
    if (request === '../services/clientIdGenerator') {
      return {
        generateNextClientId: async () => 'C888888',
      };
    }
    if (request === '../services/clientProfileWriteGuard.service') {
      return {
        persistClientProfileOrRollback: async ({ client }) => {
          await client.deleteOne(); // simulate rollback path in helper
          throw new Error('profile write failed');
        },
      };
    }
    if (request === '../services/case.service') {
      return {
        updateStatus: async () => {
          updateStatusCalled = true;
        },
      };
    }
    if (request === '../config/constants') {
      return {
        CASE_CATEGORIES: { CLIENT_NEW: 'CLIENT_NEW' },
        CLIENT_STATUS: { ACTIVE: 'ACTIVE' },
      };
    }
    if (request === '../domain/case/caseStatus') {
      return {
        SUBMITTED: 'SUBMITTED',
        UNDER_REVIEW: 'UNDER_REVIEW',
        REVIEWED: 'REVIEWED',
        APPROVED: 'APPROVED',
      };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (request === '../utils/clientStatus') {
      return {
        CANONICAL_CLIENT_STATUSES: { ACTIVE: 'ACTIVE' },
        buildClientStatusQuery: () => ({ $in: ['ACTIVE'] }),
      };
    }
    if (
      request.includes('/models/')
      || request.includes('/services/')
      || request.includes('/utils/')
      || request.includes('/middleware/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/clientApproval.controller');
  const { approveNewClient } = require('../src/controllers/clientApproval.controller');
  const req = createRequest();
  const res = createRes();

  await approveNewClient(req, res);

  assert.strictEqual(res.statusCode, 400, 'profile failure should return error response');
  assert.strictEqual(rollbackDeleteCalled, true, 'rollback path should delete orphan client record');
  assert.strictEqual(updateStatusCalled, false, 'case status should not advance when profile write fails');
  assert.strictEqual(res.body.success, false);
  console.log('  ✓ approve-new profile failure rolls back and prevents orphan records');
}

async function run() {
  try {
    await testApprovalGeneratesClientIdAndReturnsUsableClient();
    await testApprovalRollsBackOnProfileFailure();
    console.log('Client approval approve-new tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error(error);
  Module._load = originalLoad;
  process.exit(1);
});
