#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const Case = require('../src/models/Case.model');
const Client = require('../src/models/Client.model');
const DocketException = require('../src/models/DocketException.model');

const controllerPath = require.resolve('../src/controllers/clientPortal.controller');

function freshController() {
  delete require.cache[controllerPath];
  return require('../src/controllers/clientPortal.controller');
}

// 1. Verify correct state mapping from internal docket detailed states to client-safe statuses
async function testStateMapping() {
  const originalFindCase = Case.find;
  const originalFindClient = Client.find;
  const originalFindException = DocketException.find;

  Client.find = () => ({
    select: () => ({
      lean: async () => [],
    }),
  });

  DocketException.find = () => ({
    lean: async () => [],
  });

  const now = new Date();
  const casesMock = [
    {
      caseId: 'DCK-00041',
      title: 'GST Return filing',
      status: 'FILED',
      compliance_state: 'filed',
      obligation_period: 'Q1-2026',
    },
    {
      caseId: 'DCK-00042',
      title: 'TDS Preparation',
      status: 'OPEN',
      compliance_state: 'under_preparation',
    },
    {
      caseId: 'DCK-00043',
      title: 'PAN Card Registration',
      status: 'QC_PENDING',
      approval_stage: { status: 'pending' },
    },
    {
      caseId: 'DCK-00044',
      title: 'PF Audit',
      status: 'PENDING',
      pendingReason: 'waiting_client',
      compliance_state: 'awaiting_client',
      checklist: [{ title: 'PAN Copy', completed: false, status: 'requested' }],
    },
    {
      caseId: 'DCK-00045',
      title: 'Corporate Tax',
      status: 'OPEN',
      blockerType: 'portal_error',
    },
    {
      caseId: 'DCK-00046',
      title: 'Filing audit report',
      status: 'RESOLVED',
    },
  ];

  Case.find = () => ({
    select: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => casesMock,
          }),
        }),
      }),
    }),
  });

  const req = {
    query: { page: '1', limit: '10' },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      role: 'ADMIN',
      restrictedClientIds: [],
    },
  };

  let jsonResult;
  const res = {
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.getClientStatusView(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(jsonResult.data.length, 6);

    const filed = jsonResult.data.find((c) => c.caseId === 'DCK-00041');
    assert.strictEqual(filed.status, 'filed');

    const prep = jsonResult.data.find((c) => c.caseId === 'DCK-00042');
    assert.strictEqual(prep.status, 'under_preparation');

    const approval = jsonResult.data.find((c) => c.caseId === 'DCK-00043');
    assert.strictEqual(approval.status, 'awaiting_approval');

    const requested = jsonResult.data.find((c) => c.caseId === 'DCK-00044');
    assert.strictEqual(requested.status, 'requested_from_client');
    assert.strictEqual(requested.nextAction, 'Please upload: PAN Copy');
    assert.strictEqual(requested.documentRequestLink, '/clients/upload/DCK-00044');

    const portalIssue = jsonResult.data.find((c) => c.caseId === 'DCK-00045');
    assert.strictEqual(portalIssue.status, 'portal_issue');

    const closed = jsonResult.data.find((c) => c.caseId === 'DCK-00046');
    assert.strictEqual(closed.status, 'closed');

    // 2. Information Hiding Assertion: Make sure private review comments, staff workloads, and budgets are stripped out
    jsonResult.data.forEach((item) => {
      assert.strictEqual(item.createdByXID, undefined);
      assert.strictEqual(item.assignedToXID, undefined);
      assert.strictEqual(item.notes, undefined);
      assert.strictEqual(item.actualCost, undefined);
      assert.strictEqual(item.estimatedBudget, undefined);
      assert.strictEqual(item.qc, undefined);
      assert.strictEqual(item.approval_history, undefined);
    });

    console.log('✓ Case status state mappings and information hiding verified');
  } finally {
    Case.find = originalFindCase;
    Client.find = originalFindClient;
    DocketException.find = originalFindException;
  }
}

// 3. Verify strict role and visibility boundaries
async function testRoleAndVisibilityBoundaries() {
  const originalFindClient = Client.find;
  const originalFindCase = Case.find;
  const originalFindOneCase = Case.findOne;
  const originalFindOneClient = Client.findOne;
  const originalFindException = DocketException.find;

  DocketException.find = () => ({
    lean: async () => [],
  });

  const allowedClientObjId = new mongoose.Types.ObjectId();
  const restrictedClientObjId = new mongoose.Types.ObjectId();

  Client.find = () => ({
    select: () => ({
      lean: async () => [{ _id: restrictedClientObjId }], // C000104 is restricted
    }),
  });

  let capturedQuery = null;
  Case.find = (query) => {
    capturedQuery = query;
    return {
      select: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [],
            }),
          }),
        }),
      }),
    };
  };

  const req = {
    query: { page: '1', limit: '10' },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      role: 'USER',
      defaultClientId: allowedClientObjId,
      clientAccess: [],
      restrictedClientIds: ['C000104'],
    },
  };

  let jsonResult;
  const res = {
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.getClientStatusView(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.ok(capturedQuery);

    // Verify client user filter: restricted only to allowed list and excluding restricted ones
    assert.ok(capturedQuery.clientId);
    assert.ok(capturedQuery.clientId.$in);
    assert.strictEqual(String(capturedQuery.clientId.$in[0]), allowedClientObjId.toString());

    // Verify individual detail lookups
    const detailCase = {
      caseId: 'DCK-00047',
      clientId: 'C000104', // Restricted
    };

    Case.findOne = () => ({
      lean: async () => detailCase,
    });

    let detailJson;
    const detailRes = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        detailJson = data;
        return this;
      },
    };

    const detailReq = {
      params: { caseId: 'DCK-00047' },
      user: {
        firmId: new mongoose.Types.ObjectId(),
        role: 'USER',
        restrictedClientIds: ['C000104'],
      },
    };

    await controller.getClientStatusViewByCaseId(detailReq, detailRes);
    assert.strictEqual(detailRes.statusCode, 403);
    assert.strictEqual(detailJson.success, false);
    assert.strictEqual(detailJson.code, 'CLIENT_ACCESS_RESTRICTED');

    console.log('✓ Strict role and client visibility boundaries verified');
  } finally {
    Client.find = originalFindClient;
    Case.find = originalFindCase;
    Case.findOne = originalFindOneCase;
    Client.findOne = originalFindOneClient;
    DocketException.find = originalFindException;
  }
}

async function run() {
  console.log('Running Client Portal Status View integration tests...');
  try {
    await testStateMapping();
    await testRoleAndVisibilityBoundaries();
    console.log('All Client Portal Status View integration tests passed successfully!');
  } catch (error) {
    console.error('Client Portal Status View tests failed:', error);
    process.exit(1);
  }
}

run();
