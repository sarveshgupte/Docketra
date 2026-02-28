#!/usr/bin/env node
const assert = require('assert');

const mongoose = require('mongoose');
const Case = require('../src/models/Case.model');
const CaseService = require('../src/services/case.service');
const CaseAudit = require('../src/models/CaseAudit.model');
const auditLogService = require('../src/services/auditLog.service');

const servicePath = require.resolve('../src/services/caseAssignment.service');

function createSession() {
  const counters = {
    started: 0,
    committed: 0,
    aborted: 0,
    ended: 0,
  };
  return {
    session: {
      startTransaction: () => { counters.started += 1; },
      commitTransaction: async () => { counters.committed += 1; },
      abortTransaction: async () => { counters.aborted += 1; },
      endSession: async () => { counters.ended += 1; },
    },
    counters,
  };
}

function freshService() {
  delete require.cache[servicePath];
  return require('../src/services/caseAssignment.service');
}

async function testBulkAssignCommitsAtomicTransaction() {
  const originalStartSession = mongoose.startSession;
  const originalUpdateMany = Case.updateMany;
  const originalFind = Case.find;
  const originalUpdateStatus = CaseService.updateStatus;
  const originalCaseAuditCreate = CaseAudit.create;
  const originalLogCaseHistory = auditLogService.logCaseHistory;

  const { session, counters } = createSession();
  const calls = {
    updateMany: 0,
    find: 0,
    updateStatus: 0,
    caseAudit: 0,
    history: 0,
  };

  mongoose.startSession = async () => session;
  Case.updateMany = async (_filter, _update, options) => {
    calls.updateMany += 1;
    assert.strictEqual(options.session, session);
    return { modifiedCount: 2 };
  };
  Case.find = async (_filter, _projection, options) => {
    calls.find += 1;
    assert.strictEqual(options.session, session);
    if (calls.find === 1) {
      return [
        { caseId: 'CASE-1', firmId: 'firm-1', status: 'UNASSIGNED' },
        { caseId: 'CASE-2', firmId: 'firm-1', status: 'UNASSIGNED' },
      ];
    }
    return [
      { caseId: 'CASE-1', firmId: 'firm-1', status: 'OPEN' },
      { caseId: 'CASE-2', firmId: 'firm-1', status: 'OPEN' },
    ];
  };
  CaseService.updateStatus = async (_caseId, _newStatus, context) => {
    calls.updateStatus += 1;
    assert.strictEqual(context.currentStatus, 'UNASSIGNED');
    assert.strictEqual(context.session, session);
  };
  CaseAudit.create = async (_docs, options) => {
    calls.caseAudit += 1;
    assert.strictEqual(options.session, session);
  };
  auditLogService.logCaseHistory = async (payload) => {
    calls.history += 1;
    assert.strictEqual(payload.session, session);
  };

  try {
    const caseAssignmentService = freshService();
    const result = await caseAssignmentService.bulkAssignCasesToUser(
      'firm-1',
      ['CASE-1', 'CASE-2'],
      { xID: 'X123456', email: 'test@example.com', role: 'Admin' }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.assigned, 2);
    assert.strictEqual(counters.started, 1);
    assert.strictEqual(counters.committed, 1);
    assert.strictEqual(counters.aborted, 0);
    assert.strictEqual(counters.ended, 1);
    assert.strictEqual(calls.updateMany, 1);
    assert.strictEqual(calls.updateStatus, 2);
    assert.strictEqual(calls.caseAudit, 1);
    assert.strictEqual(calls.history, 2);
    console.log('✓ Bulk assignment commits transaction and propagates session');
  } finally {
    mongoose.startSession = originalStartSession;
    Case.updateMany = originalUpdateMany;
    Case.find = originalFind;
    CaseService.updateStatus = originalUpdateStatus;
    CaseAudit.create = originalCaseAuditCreate;
    auditLogService.logCaseHistory = originalLogCaseHistory;
    delete require.cache[servicePath];
  }
}

async function testBulkAssignRollsBackOnTransitionFailure() {
  const originalStartSession = mongoose.startSession;
  const originalUpdateMany = Case.updateMany;
  const originalFind = Case.find;
  const originalUpdateStatus = CaseService.updateStatus;
  const originalCaseAuditCreate = CaseAudit.create;
  const originalLogCaseHistory = auditLogService.logCaseHistory;

  const { session, counters } = createSession();
  let updateStatusCalls = 0;
  let caseAuditCalls = 0;
  let historyCalls = 0;

  mongoose.startSession = async () => session;
  Case.updateMany = async () => ({ modifiedCount: 2 });
  Case.find = async (_filter, _projection, options) => {
    assert.strictEqual(options.session, session);
    return [
      { caseId: 'CASE-1', firmId: 'firm-1', status: 'UNASSIGNED' },
      { caseId: 'CASE-2', firmId: 'firm-1', status: 'UNASSIGNED' },
    ];
  };
  CaseService.updateStatus = async () => {
    updateStatusCalls += 1;
    if (updateStatusCalls === 2) {
      throw new Error('Illegal transition: UNASSIGNED → OPEN');
    }
  };
  CaseAudit.create = async () => { caseAuditCalls += 1; };
  auditLogService.logCaseHistory = async () => { historyCalls += 1; };

  try {
    const caseAssignmentService = freshService();
    await assert.rejects(
      () => caseAssignmentService.bulkAssignCasesToUser(
        'firm-1',
        ['CASE-1', 'CASE-2'],
        { xID: 'X123456', email: 'test@example.com', role: 'Admin' }
      ),
      /Illegal transition/
    );

    assert.strictEqual(counters.committed, 0);
    assert.strictEqual(counters.aborted, 1);
    assert.strictEqual(counters.ended, 1);
    assert.strictEqual(caseAuditCalls, 0);
    assert.strictEqual(historyCalls, 0);
    console.log('✓ Bulk assignment aborts transaction on transition failure');
  } finally {
    mongoose.startSession = originalStartSession;
    Case.updateMany = originalUpdateMany;
    Case.find = originalFind;
    CaseService.updateStatus = originalUpdateStatus;
    CaseAudit.create = originalCaseAuditCreate;
    auditLogService.logCaseHistory = originalLogCaseHistory;
    delete require.cache[servicePath];
  }
}

async function testReplicaSetErrorIsClear() {
  const originalStartSession = mongoose.startSession;
  const { session, counters } = createSession();
  session.startTransaction = () => {
    counters.started += 1;
    throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
  };

  mongoose.startSession = async () => session;
  try {
    const caseAssignmentService = freshService();
    await assert.rejects(
      () => caseAssignmentService.bulkAssignCasesToUser(
        'firm-1',
        ['CASE-1'],
        { xID: 'X123456', email: 'test@example.com', role: 'Admin' }
      ),
      /MongoDB transactions require replica set/
    );
    assert.strictEqual(counters.ended, 1);
    console.log('✓ Replica set requirement error is surfaced clearly');
  } finally {
    mongoose.startSession = originalStartSession;
    delete require.cache[servicePath];
  }
}

async function run() {
  try {
    await testBulkAssignCommitsAtomicTransaction();
    await testBulkAssignRollsBackOnTransitionFailure();
    await testReplicaSetErrorIsClear();
    console.log('Case assignment transaction tests passed.');
  } catch (error) {
    console.error('Case assignment transaction tests failed:', error);
    process.exit(1);
  }
}

run();
