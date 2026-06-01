#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const DocketException = require('../src/models/DocketException.model');
const Client = require('../src/models/Client.model');
const Case = require('../src/models/Case.model');
const Comment = require('../src/models/Comment.model');
const CaseHistory = require('../src/models/CaseHistory.model');

const exceptionControllerPath = require.resolve('../src/controllers/docketException.controller');
const portalControllerPath = require.resolve('../src/controllers/clientPortal.controller');

function freshExceptionController() {
  delete require.cache[exceptionControllerPath];
  return require('../src/controllers/docketException.controller');
}

function freshPortalController() {
  delete require.cache[portalControllerPath];
  return require('../src/controllers/clientPortal.controller');
}

// 1. Verify Exception Creation & Client Restrictions
async function testCreateDocketException() {
  const originalFindCase = Case.findOne;
  const originalFindClient = Client.findOne;
  const originalSave = DocketException.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  let savedData = null;
  DocketException.prototype.save = async function () {
    savedData = this;
    return this;
  };

  const caseMockId = new mongoose.Types.ObjectId();
  const clientMockId = new mongoose.Types.ObjectId();

  Case.findOne = () => ({
    _id: caseMockId,
    caseInternalId: caseMockId,
    caseId: 'DCK-00051',
    caseNumber: 'DCK-00051',
    clientId: 'C000105',
    status: 'OPEN',
  });

  Client.findOne = () => ({
    lean: async () => ({ _id: clientMockId, clientId: 'C000105' }),
  });

  let commentPayload = null;
  Comment.create = async (payload) => {
    commentPayload = payload;
    return payload;
  };

  let historyPayload = null;
  CaseHistory.create = async (payload) => {
    historyPayload = payload;
    return payload;
  };

  const req = {
    body: {
      caseInternalId: caseMockId.toString(),
      exceptionType: 'portal_issue',
      description: 'GST Portal down during GSTR-1 filing',
      occurredAt: new Date().toISOString(),
      ticketNumber: 'TKT-99182',
      revisedEta: new Date(Date.now() + 86400000).toISOString(),
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'officer@example.com',
      xID: 'X000002',
      role: 'USER',
      restrictedClientIds: [],
    },
  };

  let jsonResult;
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshExceptionController();
    await controller.createDocketException(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(savedData);
    assert.strictEqual(savedData.exceptionType, 'portal_issue');
    assert.strictEqual(savedData.ticketNumber, 'TKT-99182');
    assert.strictEqual(savedData.description, 'GST Portal down during GSTR-1 filing');

    // Verify comment and audit history
    assert.ok(commentPayload);
    assert.match(commentPayload.text, /Logged new regulatory exception/);
    assert.ok(historyPayload);
    assert.strictEqual(historyPayload.actionType, 'ExceptionLogged');

    // Test client restrictions (returns 403 Forbidden)
    req.user.restrictedClientIds = ['C000105'];
    let restrictedJson;
    const restrictedRes = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        restrictedJson = data;
        return this;
      },
    };

    await controller.createDocketException(req, restrictedRes);
    assert.strictEqual(restrictedRes.statusCode, 403);
    assert.strictEqual(restrictedJson.success, false);
    assert.strictEqual(restrictedJson.code, 'CLIENT_ACCESS_RESTRICTED');

    console.log('✓ Exception creation, comment logging, and restricted client blocking verified');
  } finally {
    Case.findOne = originalFindCase;
    Client.findOne = originalFindClient;
    DocketException.prototype.save = originalSave;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 2. Verify Audit Trails on Exception Updates
async function testUpdateDocketException() {
  const originalFindException = DocketException.findOne;
  const originalFindCase = Case.findOne;
  const originalSave = DocketException.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const caseMockId = new mongoose.Types.ObjectId();
  const exceptionMock = {
    _id: new mongoose.Types.ObjectId(),
    caseInternalId: caseMockId,
    exceptionType: 'DSC_authorisation_pending',
    description: 'DSC key locked',
    owner: 'X000002',
    status: 'open',
    ticketNumber: 'T-100',
    revisedEta: new Date('2026-06-01'),
    save: async function () { return this; },
  };

  DocketException.findOne = () => exceptionMock;

  Case.findOne = () => ({
    caseId: 'DCK-00051',
    caseNumber: 'DCK-00051',
    clientId: 'C000105',
  });

  let commentPayload = null;
  Comment.create = async (payload) => {
    commentPayload = payload;
    return payload;
  };

  let historyPayload = null;
  CaseHistory.create = async (payload) => {
    historyPayload = payload;
    return payload;
  };

  const req = {
    params: { id: exceptionMock._id.toString() },
    body: {
      status: 'resolved',
      description: 'DSC key unlocked successfully',
      revisedEta: null,
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'officer@example.com',
      xID: 'X000002',
      role: 'USER',
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
    const controller = freshExceptionController();
    await controller.updateDocketException(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(exceptionMock.status, 'resolved');
    assert.strictEqual(exceptionMock.description, 'DSC key unlocked successfully');

    // Assert change log and comments
    assert.ok(commentPayload);
    assert.match(commentPayload.text, /status transitioned/);
    assert.match(commentPayload.text, /description changed/);

    assert.ok(historyPayload);
    assert.strictEqual(historyPayload.actionType, 'ExceptionUpdated');

    console.log('✓ Detailed exception update audit trails verified');
  } finally {
    DocketException.findOne = originalFindException;
    Case.findOne = originalFindCase;
    DocketException.prototype.save = originalSave;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 3. Verify Dashboard Aggregations and Client-Safe Bounds
async function testExceptionDashboardAndIsolation() {
  const originalFindClient = Client.find;
  const originalFindException = DocketException.find;

  const allowedClientObjId = new mongoose.Types.ObjectId();
  const restrictedClientObjId = new mongoose.Types.ObjectId();

  Client.find = () => ({
    select: () => ({
      lean: async () => [{ _id: restrictedClientObjId }], // C000104 is restricted
    }),
  });

  const now = new Date();
  const rawExceptionsMock = [
    {
      exceptionType: 'portal_issue',
      occurredAt: now,
      clientId: { _id: allowedClientObjId, clientId: 'C000101', businessName: 'Acme Corp' },
      caseInternalId: { dueDate: new Date(Date.now() - 86400000) }, // Overdue Case
    },
    {
      exceptionType: 'query_raised',
      occurredAt: new Date(Date.now() - 5 * 86400000), // 5 days old (between 3-7 days)
      clientId: { _id: allowedClientObjId, clientId: 'C000101', businessName: 'Acme Corp' },
      caseInternalId: { dueDate: new Date(Date.now() + 86400000) }, // Close due Case (1 day left)
    },
    {
      exceptionType: 'DSC_authorisation_pending',
      occurredAt: new Date(Date.now() - 10 * 86400000), // 10 days old (>7 days)
      clientId: { _id: restrictedClientObjId, clientId: 'C000104', businessName: 'Restricted LLC' },
      caseInternalId: { dueDate: new Date(Date.now() - 86400000) },
    },
  ];

  let queryCaptured = null;
  DocketException.find = (query) => {
    queryCaptured = query;
    // Exclude restricted client in mock return to simulate Mongoose behavior
    const filtered = rawExceptionsMock.filter((ex) => {
      if (query.clientId?.$nin) {
        return !query.clientId.$nin.some((rid) => String(rid) === String(ex.clientId._id));
      }
      return true;
    });
    return {
      populate: () => ({
        populate: () => ({
          lean: async () => filtered,
        }),
      }),
    };
  };

  const req = {
    user: {
      firmId: new mongoose.Types.ObjectId(),
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
    const controller = freshExceptionController();
    await controller.getExceptionDashboard(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.ok(queryCaptured);
    assert.ok(queryCaptured.clientId?.$nin);

    const dashboard = jsonResult.data;

    // Verify type count (Restricted LLC's DSC exception must be excluded)
    assert.strictEqual(dashboard.byType.portal_issue, 1);
    assert.strictEqual(dashboard.byType.query_raised, 1);
    assert.strictEqual(dashboard.byType.DSC_authorisation_pending, 0);

    // Verify age count (Allowed exceptions are 0 days and 5 days old)
    assert.strictEqual(dashboard.byAge.under_3_days, 1);
    assert.strictEqual(dashboard.byAge.between_3_and_7_days, 1);
    assert.strictEqual(dashboard.byAge.over_7_days, 0);

    // Verify client count exclusion
    assert.strictEqual(dashboard.byClient['Acme Corp (C000101)'], 2);
    assert.strictEqual(dashboard.byClient['Restricted LLC (C000104)'], undefined);

    // Verify due date risk (Allowed: 1 overdue, 1 close due => total 2 atRisk)
    assert.strictEqual(dashboard.dueDateRisk.overdue, 1);
    assert.strictEqual(dashboard.dueDateRisk.closeDue, 1);
    assert.strictEqual(dashboard.dueDateRisk.atRisk, 2);

    console.log('✓ Exception dashboard aggregations and restricted client exclusions verified');
  } finally {
    Client.find = originalFindClient;
    DocketException.find = originalFindException;
  }
}

// 4. Verify Client Portal Status view overrides based on active exceptions
async function testClientPortalStatusOverride() {
  const originalFindClient = Client.find;
  const originalFindCase = Case.find;
  const originalFindException = DocketException.find;

  Client.find = () => ({
    select: () => ({
      lean: async () => [],
    }),
  });

  const casesMock = [
    {
      _id: new mongoose.Types.ObjectId(),
      caseId: 'DCK-00061',
      title: 'GST GSTR-3B Filing',
      status: 'OPEN',
      compliance_state: 'under_preparation',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      caseId: 'DCK-00062',
      title: 'TDS Payment',
      status: 'OPEN',
      compliance_state: 'under_preparation',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      caseId: 'DCK-00063',
      title: 'PF Filing',
      status: 'OPEN',
      compliance_state: 'under_preparation',
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

  DocketException.find = (query) => {
    // Mock active exceptions:
    // DCK-00061 has a portal_issue exception
    // DCK-00062 has a DSC pending exception (client delay)
    // DCK-00063 has no exceptions
    const exList = [
      {
        caseInternalId: casesMock[0]._id,
        exceptionType: 'portal_issue',
      },
      {
        caseInternalId: casesMock[1]._id,
        exceptionType: 'DSC_authorisation_pending',
      },
    ];

    // Filter list simulated
    const filtered = exList.filter((ex) => query.caseInternalId.$in.some((id) => String(id) === String(ex.caseInternalId)));
    return {
      lean: async () => filtered,
    };
  };

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
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const portalController = freshPortalController();
    await portalController.getClientStatusView(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(jsonResult.data.length, 3);

    // DCK-00061: has portal_issue active exception -> status is overridden to 'portal_issue'
    const c1 = jsonResult.data.find((c) => c.caseId === 'DCK-00061');
    assert.strictEqual(c1.status, 'portal_issue');

    // DCK-00062: has DSC pending active exception -> status is overridden to 'requested_from_client'
    const c2 = jsonResult.data.find((c) => c.caseId === 'DCK-00062');
    assert.strictEqual(c2.status, 'requested_from_client');

    // DCK-00063: no active exceptions -> status maps normally to 'under_preparation'
    const c3 = jsonResult.data.find((c) => c.caseId === 'DCK-00063');
    assert.strictEqual(c3.status, 'under_preparation');

    console.log('✓ Active exception status mapping overrides inside client portal verified successfully');
  } finally {
    Client.find = originalFindClient;
    Case.find = originalFindCase;
    DocketException.find = originalFindException;
  }
}

async function run() {
  console.log('Running Docket Exception Tracking integration tests...');
  try {
    await testCreateDocketException();
    await testUpdateDocketException();
    await testExceptionDashboardAndIsolation();
    await testClientPortalStatusOverride();
    console.log('All Docket Exception Tracking integration tests passed successfully!');
  } catch (error) {
    console.error('Docket Exception Tracking tests failed:', error);
    process.exit(1);
  }
}

run();
