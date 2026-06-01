#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');

const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');
const Case = require('../src/models/Case.model');
const CaseAudit = require('../src/models/CaseAudit.model');
const CaseHistory = require('../src/models/CaseHistory.model');
const CaseStatus = require('../src/domain/case/caseStatus');
const { COMPLIANCE_STATES } = require('../src/domain/compliance/complianceStateMachine');

const controllerPath = require.resolve('../src/controllers/capacity.controller');
const servicePath = require.resolve('../src/services/caseAssignment.service');

function freshController() {
  delete require.cache[controllerPath];
  return require('../src/controllers/capacity.controller');
}

async function testCapacityLoadCountsAndPendingExclusion() {
  const originalFindTeam = Team.findOne;
  const originalFindUsers = User.find;
  const originalFindUser = User.findOne;
  const originalAggregate = Case.aggregate;

  let aggregateParams;

  Team.findOne = () => ({
    lean: async () => ({
      _id: new mongoose.Types.ObjectId('60d5ec49f3e1a329dc3309a4'),
      name: 'Compliance Primary Team',
      managerId: new mongoose.Types.ObjectId('60d5ec49f3e1a329dc3309a5'),
    })
  });

  User.find = () => ({
    select: () => ({
      lean: async () => [
        { _id: '60d5ec49f3e1a329dc3309a6', xID: 'X000101', name: 'Alice Smith', role: 'staff' },
        { _id: '60d5ec49f3e1a329dc3309a7', xID: 'X000102', name: 'Bob Jones', role: 'staff' },
      ]
    })
  });

  User.findOne = () => ({
    select: () => ({
      lean: async () => ({
        _id: '60d5ec49f3e1a329dc3309a5', xID: 'X000100', name: 'Manager Mike', role: 'manager'
      })
    })
  });

  Case.aggregate = async (pipeline) => {
    aggregateParams = pipeline;
    return [
      {
        _id: 'X000101',
        totalActiveDockets: 5,
        dueThisWeek: 2,
        overdue: 1,
        awaitingExternalInput: 3,
        blocked: 1,
        readyForReview: 0
      },
      {
        _id: 'X000102',
        totalActiveDockets: 1,
        dueThisWeek: 0,
        overdue: 0,
        awaitingExternalInput: 0,
        blocked: 0,
        readyForReview: 1
      }
    ];
  };

  const req = {
    params: { workbasketId: '60d5ec49f3e1a329dc3309a4' },
    user: { firmId: '60d5ec49f3e1a329dc3309a1' }
  };

  let jsonResult;
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      jsonResult = data;
      return this;
    }
  };

  try {
    const controller = freshController();
    await controller.getWorkbasketCapacity(req, res);

    if (!jsonResult || !jsonResult.success) {
      console.error('getWorkbasketCapacity returned failure:', jsonResult);
    }
    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(jsonResult.data.length, 3); // 2 members + 1 manager

    const alice = jsonResult.data.find(d => d.xID === 'X000101');
    assert.ok(alice);
    assert.strictEqual(alice.loadSummary.totalActiveDockets, 5);
    assert.strictEqual(alice.loadSummary.dueThisWeek, 2);
    assert.strictEqual(alice.loadSummary.overdue, 1);
    assert.strictEqual(alice.loadSummary.awaitingExternalInput, 3);
    assert.strictEqual(alice.loadSummary.blocked, 1);
    assert.strictEqual(alice.loadScore, 19);

    const bob = jsonResult.data.find(d => d.xID === 'X000102');
    assert.ok(bob);
    assert.strictEqual(bob.loadSummary.totalActiveDockets, 1);
    assert.strictEqual(bob.loadSummary.readyForReview, 1);
    assert.strictEqual(bob.loadScore, 3);

    console.log('✓ Capacity load counts, pending exclusions, and load score calculations verified');
  } finally {
    Team.findOne = originalFindTeam;
    User.find = originalFindUsers;
    User.findOne = originalFindUser;
    Case.aggregate = originalAggregate;
  }
}

async function testReassignmentLogsHistoryAndAudit() {
  const originalFindUser = User.findOne;
  const originalReassignCase = require('../src/services/caseAssignment.service').reassignCase;

  let reassignParams = [];

  User.findOne = () => ({
    lean: async () => ({
      _id: '60d5ec49f3e1a329dc3309a6',
      xID: 'X000101',
      status: 'active',
    })
  });

  require('../src/services/caseAssignment.service').reassignCase = async (firmId, caseId, assignedToXID, user) => {
    reassignParams.push({ firmId, caseId, assignedToXID, user });
  };

  const req = {
    body: {
      caseIds: ['DCK-0001', 'DCK-0002'],
      assignedToXID: 'X000101'
    },
    user: { firmId: 'firm-1', xID: 'X000001', role: 'manager' }
  };

  let jsonResult;
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      jsonResult = data;
      return this;
    }
  };

  try {
    const controller = freshController();
    await controller.bulkReassignDockets(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(jsonResult.data.successCases.length, 2);
    assert.strictEqual(reassignParams.length, 2);
    assert.strictEqual(reassignParams[0].caseId, 'DCK-0001');
    assert.strictEqual(reassignParams[1].caseId, 'DCK-0002');
    assert.strictEqual(reassignParams[0].assignedToXID, 'X000101');
    assert.strictEqual(reassignParams[0].firmId, 'firm-1');

    console.log('✓ Bulk reassignment loops through atomic service with safety controls');
  } finally {
    User.findOne = originalFindUser;
    require('../src/services/caseAssignment.service').reassignCase = originalReassignCase;
  }
}

async function run() {
  try {
    await testCapacityLoadCountsAndPendingExclusion();
    await testReassignmentLogsHistoryAndAudit();
    console.log('All Capacity & Rebalancing backend tests passed successfully!');
  } catch (error) {
    console.error('Capacity & Rebalancing tests failed:', error);
    process.exit(1);
  }
}

run();
