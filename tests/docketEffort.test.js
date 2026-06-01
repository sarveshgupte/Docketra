#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const DocketEffort = require('../src/models/DocketEffort.model');
const Client = require('../src/models/Client.model');
const Case = require('../src/models/Case.model');
const Comment = require('../src/models/Comment.model');
const CaseHistory = require('../src/models/CaseHistory.model');

const controllerPath = require.resolve('../src/controllers/docketEffort.controller');

function freshController() {
  delete require.cache[controllerPath];
  return require('../src/controllers/docketEffort.controller');
}

// 1. Verify Effort Entry Logging Ingestion & Case Accumulator Math
async function testCreateEffortEntry() {
  const originalSaveCase = Case.prototype.save;
  const originalFindCase = Case.findOne;
  const originalFindClient = Client.findOne;
  const originalSaveEffort = DocketEffort.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const caseObjId = new mongoose.Types.ObjectId();
  const clientObjId = new mongoose.Types.ObjectId();

  const mockCase = {
    _id: caseObjId,
    caseId: 'DCK-11111',
    caseNumber: 'DCK-11111',
    clientId: 'C9999',
    actualMinutes: 10,
    save: async function () {
      return this;
    },
  };

  Case.findOne = () => mockCase;

  Client.findOne = () => ({
    lean: async () => ({
      _id: clientObjId,
      clientId: 'C9999',
    })
  });

  let savedEffort = null;
  DocketEffort.prototype.save = async function () {
    savedEffort = this;
    return this;
  };

  let loggedComment = null;
  Comment.create = async function (payload) {
    loggedComment = payload;
    return payload;
  };

  let loggedHistory = null;
  CaseHistory.create = async function (payload) {
    loggedHistory = payload;
    return payload;
  };

  const req = {
    body: {
      caseInternalId: caseObjId.toString(),
      minutes: 45,
      activityType: 'filing',
      note: 'Filing GSTR-1 for client',
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'member@example.com',
      xID: 'X8888',
      role: 'MEMBER',
      restrictedClientIds: [],
    },
  };

  let statusCode = null;
  let jsonResult = null;
  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.createDocketEffort(req, res);

    assert.strictEqual(statusCode, 201);
    assert.ok(jsonResult.success);
    assert.strictEqual(savedEffort.minutes, 45);
    assert.strictEqual(savedEffort.activityType, 'filing');
    assert.strictEqual(mockCase.actualMinutes, 55); // 10 + 45

    assert.ok(loggedComment);
    assert.ok(loggedComment.text.includes('Logged 45 minutes of effort'));
    assert.ok(loggedHistory);
    assert.strictEqual(loggedHistory.actionType, 'EffortLogged');

    console.log('✓ Effort logging ingestion, case accumulator increment, comments, and case history verified');
  } finally {
    Case.prototype.save = originalSaveCase;
    Case.findOne = originalFindCase;
    Client.findOne = originalFindClient;
    DocketEffort.prototype.save = originalSaveEffort;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 2. Verify Client Exclusions and Security Restricting Boundaries
async function testCreateEffortEntryRestrictedClient() {
  const originalFindCase = Case.findOne;

  const caseObjId = new mongoose.Types.ObjectId();

  Case.findOne = () => ({
    _id: caseObjId,
    caseId: 'DCK-11111',
    clientId: 'RESTRICTED-C01',
  });

  const req = {
    body: {
      caseInternalId: caseObjId.toString(),
      minutes: 20,
      activityType: 'review',
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'member@example.com',
      xID: 'X8888',
      role: 'MEMBER',
      restrictedClientIds: ['RESTRICTED-C01'],
    },
  };

  let statusCode = null;
  let jsonResult = null;
  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.createDocketEffort(req, res);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonResult.code, 'CLIENT_ACCESS_RESTRICTED');
    console.log('✓ Restricted client access boundaries blocked effort logging successfully');
  } finally {
    Case.findOne = originalFindCase;
  }
}

// 3. Verify Effort Deletion and Case Accumulator Decrement
async function testDeleteEffortEntry() {
  const originalFindEffort = DocketEffort.findOne;
  const originalDeleteEffort = DocketEffort.deleteOne;
  const originalFindCase = Case.findOne;
  const originalSaveCase = Case.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const caseObjId = new mongoose.Types.ObjectId();
  const effortObjId = new mongoose.Types.ObjectId();

  const mockCase = {
    _id: caseObjId,
    caseId: 'DCK-11111',
    actualMinutes: 50,
    save: async function () {
      return this;
    },
  };

  DocketEffort.findOne = () => ({
    _id: effortObjId,
    caseInternalId: caseObjId,
    userXID: 'X8888',
    minutes: 30,
    activityType: 'review',
  });

  Case.findOne = () => mockCase;

  let deleted = false;
  DocketEffort.deleteOne = async function () {
    deleted = true;
    return { deletedCount: 1 };
  };

  let loggedComment = null;
  Comment.create = async function (payload) {
    loggedComment = payload;
    return payload;
  };

  CaseHistory.create = async function (payload) {
    return payload;
  };

  const req = {
    params: { id: effortObjId.toString() },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'member@example.com',
      xID: 'X8888',
      role: 'MEMBER',
    },
  };

  let statusCode = null;
  let jsonResult = null;
  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.deleteDocketEffort(req, res);

    assert.ok(jsonResult.success);
    assert.ok(deleted);
    assert.strictEqual(mockCase.actualMinutes, 20); // 50 - 30
    assert.ok(loggedComment);
    assert.ok(loggedComment.text.includes('Deleted time effort entry of 30 minutes'));

    console.log('✓ Effort logging deletion, case accumulator decrement, and audit trail verified');
  } finally {
    DocketEffort.findOne = originalFindEffort;
    DocketEffort.deleteOne = originalDeleteEffort;
    Case.findOne = originalFindCase;
    Case.prototype.save = originalSaveCase;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 4. Verify Docket Direct Budget & Target expectedMinutes Updates
async function testUpdateDocketBudget() {
  const originalFindCase = Case.findOne;
  const originalSaveCase = Case.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const caseObjId = new mongoose.Types.ObjectId();
  const mockCase = {
    _id: caseObjId,
    caseId: 'DCK-22222',
    expectedMinutes: 60,
    estimatedBudget: 500,
    clientId: 'C101',
    save: async function () {
      return this;
    },
  };

  Case.findOne = () => mockCase;

  let loggedComment = null;
  Comment.create = async function (payload) {
    loggedComment = payload;
    return payload;
  };

  CaseHistory.create = async function (payload) {
    return payload;
  };

  const req = {
    params: { caseId: 'DCK-22222' },
    body: {
      expectedMinutes: 90,
      estimatedBudget: 800,
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'admin@example.com',
      xID: 'X0001',
      role: 'ADMIN',
      restrictedClientIds: [],
    },
  };

  let statusCode = null;
  let jsonResult = null;
  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.updateDocketBudget(req, res);

    assert.ok(jsonResult.success);
    assert.strictEqual(mockCase.expectedMinutes, 90);
    assert.strictEqual(mockCase.estimatedBudget, 800);
    assert.ok(loggedComment);
    assert.ok(loggedComment.text.includes('Expected minutes adjusted from 60 to 90'));

    console.log('✓ Docket direct budget, expected minutes targets, comments, and histories verified');
  } finally {
    Case.findOne = originalFindCase;
    Case.prototype.save = originalSaveCase;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 5. Verify Profitability Reporting & Admin Boundaries
async function testProfitabilityReports() {
  const originalFindCase = Case.find;
  const originalFindEffort = DocketEffort.find;
  const originalFindClient = Client.find;

  const clientMockObjId = new mongoose.Types.ObjectId();

  Client.find = () => ({
    select: () => ({
      lean: async () => [{ _id: clientMockObjId, clientId: 'C9999', businessName: 'Standard Corp' }],
    }),
  });

  const mockCases = [
    {
      _id: new mongoose.Types.ObjectId(),
      caseId: 'DCK-11111',
      title: 'Filing GSTR-1',
      clientId: 'C9999',
      expectedMinutes: 60,
      actualMinutes: 80,
      estimatedBudget: 500,
      actualCost: 100,
      obligation_type: 'GST',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      caseId: 'DCK-22222',
      title: 'ROC Filing',
      clientId: 'C9999',
      expectedMinutes: 120,
      actualMinutes: 90,
      estimatedBudget: 1000,
      actualCost: 200,
      obligation_type: 'ROC',
    },
  ];

  Case.find = () => ({
    lean: async () => mockCases,
  });

  const mockEfforts = [
    {
      caseInternalId: mockCases[0]._id,
      clientId: clientMockObjId,
      minutes: 80,
      activityType: 'filing',
    },
    {
      caseInternalId: mockCases[1]._id,
      clientId: clientMockObjId,
      minutes: 90,
      activityType: 'review',
    },
  ];

  DocketEffort.find = () => ({
    lean: async () => mockEfforts,
  });

  const reqAdmin = {
    user: {
      firmId: new mongoose.Types.ObjectId(),
      role: 'ADMIN',
      restrictedClientIds: [],
    },
  };

  const reqEmployee = {
    user: {
      firmId: new mongoose.Types.ObjectId(),
      role: 'EMPLOYEE',
    },
  };

  let statusCode = null;
  let jsonResult = null;
  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();

    // Verify non-admin blocked
    await controller.getProfitabilityReports(reqEmployee, res);
    assert.strictEqual(statusCode, 403);

    // Verify admin authorized and reports compiled correctly
    statusCode = null;
    await controller.getProfitabilityReports(reqAdmin, res);

    assert.ok(jsonResult.success);
    const reports = jsonResult.data;

    // Budget vs Actual
    assert.strictEqual(reports.budgetVsActual.length, 2);
    assert.strictEqual(reports.budgetVsActual[0].caseId, 'DCK-11111');
    assert.strictEqual(reports.budgetVsActual[0].timeVariance, 20); // 80 - 60

    // Client effort summary
    assert.strictEqual(reports.clientSummary.length, 1);
    assert.strictEqual(reports.clientSummary[0].clientId, 'C9999');
    assert.strictEqual(reports.clientSummary[0].totalMinutes, 170); // 80 + 90

    // Service-line effort summary
    assert.strictEqual(reports.serviceLineSummary.length, 2);
    const gstSummary = reports.serviceLineSummary.find(s => s.serviceLine === 'GST');
    assert.strictEqual(gstSummary.totalMinutes, 80);

    // Variance reports
    const rocVariance = reports.obligationVariance.find(o => o.serviceLine === 'ROC');
    assert.strictEqual(rocVariance.varianceMinutes, -30); // 90 - 120

    console.log('✓ Profitability aggregates (budget actual, clients, service-lines, variance) and admin guards verified successfully');
  } finally {
    Case.find = originalFindCase;
    DocketEffort.find = originalFindEffort;
    Client.find = originalFindClient;
  }
}

async function run() {
  console.log('Running Docketra Effort Capture & Profitability V1 integration tests...');
  try {
    await testCreateEffortEntry();
    await testCreateEffortEntryRestrictedClient();
    await testDeleteEffortEntry();
    await testUpdateDocketBudget();
    await testProfitabilityReports();
    console.log('All Docketra Effort Capture & Profitability V1 integration tests passed successfully!');
  } catch (error) {
    console.error('Docketra Effort Capture & Profitability V1 tests failed:', error);
    process.exit(1);
  }
}

run();
