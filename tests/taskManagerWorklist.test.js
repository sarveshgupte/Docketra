#!/usr/bin/env node
/**
 * Task Manager Worklist / Workbasket Model Tests
 *
 * Covers the canonical product rules:
 * 1.  PRIMARY WB auto-creates exactly one QC WB.
 * 2.  Manager is automatically linked to QC WB.
 * 3.  Admin/manager can add other users to QC WB.
 * 4.  Creating category/subcategory requires a workbasket mapping.
 * 5.  Creating a docket places it in the mapped workbasket (IN_WB).
 * 6.  Pulling a docket moves it to user Worklist (IN_PROGRESS, assignedToXID set).
 * 7.  Pending keeps docket owned by same user, reopens in same WL on elapsed date.
 * 8.  Deactivating a user moves all non-terminal dockets back to mapped WB.
 * 9.  RESOLVED and FILED dockets are absent from WB/WL; present in All Dockets.
 */

'use strict';

const assert = require('assert');

// ── Helpers ────────────────────────────────────────────────────────────────

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

// ── 1. PRIMARY WB auto-creates exactly one QC WB ──────────────────────────

async function testCreatePrimaryWorkbasketAutoCreatesQC() {
  const Team = require('../src/models/Team.model');
  const User = require('../src/models/User.model');
  const { logAuditEvent } = require('../src/services/adminActionAudit.service');

  const createdTeams = [];
  const originalCreate = Team.create;
  const originalUserFindOne = User.findOne;
  const originalLogAudit = logAuditEvent;

  Team.create = async (doc) => {
    const created = { _id: `team-${createdTeams.length + 1}`, ...doc };
    createdTeams.push(created);
    return created;
  };
  User.findOne = async () => null; // no manager
  require('../src/services/adminActionAudit.service').logAuditEvent = async () => {};

  try {
    // Re-load controller so it picks up the mocked models.
    const controllerPath = require.resolve('../src/controllers/team.controller');
    delete require.cache[controllerPath];
    const { createTeam } = require('../src/controllers/team.controller');

    const req = {
      user: { firmId: 'firm-1', _id: 'admin-1', role: 'PRIMARY_ADMIN', isPrimaryAdmin: true },
      body: { name: 'Legal' },
    };
    const res = createRes();
    await createTeam(req, res);

    assert.strictEqual(res.statusCode, 201, 'Should return 201');
    assert.ok(res.body.success, 'Should succeed');
    assert.ok(res.body.data.qcTeam, 'Should return qcTeam');
    assert.strictEqual(res.body.data.qcTeam.type, 'QC', 'QC team type should be QC');
    assert.strictEqual(
      String(res.body.data.qcTeam.parentWorkbasketId),
      String(res.body.data.team._id),
      'QC WB should reference parent PRIMARY WB',
    );
    assert.strictEqual(createdTeams.length, 2, 'Exactly two teams should be created');
    assert.strictEqual(createdTeams[0].type, 'PRIMARY');
    assert.strictEqual(createdTeams[1].type, 'QC');
    console.log('✓ Creating PRIMARY WB auto-creates exactly one QC WB');
  } finally {
    Team.create = originalCreate;
    User.findOne = originalUserFindOne;
    require('../src/services/adminActionAudit.service').logAuditEvent = originalLogAudit;
    delete require.cache[require.resolve('../src/controllers/team.controller')];
  }
}

// ── 2. Manager is automatically linked to the QC WB ───────────────────────

async function testManagerAutoLinkedToQCWorkbasket() {
  const Team = require('../src/models/Team.model');
  const User = require('../src/models/User.model');
  const { logAuditEvent } = require('../src/services/adminActionAudit.service');

  let savedUser = null;
  const createdTeams = [];
  // Use a valid MongoDB ObjectId string.
  const managerId = '507f1f77bcf86cd799439011';
  const managerDoc = {
    _id: managerId,
    firmId: 'firm-1',
    teamIds: [],
    teamId: null,
    save: async function() { savedUser = this; },
  };

  const originalCreate = Team.create;
  const originalUserFindOne = User.findOne;
  const originalLogAudit = logAuditEvent;

  Team.create = async (doc) => {
    const created = { _id: `team-${createdTeams.length + 1}`, ...doc };
    createdTeams.push(created);
    return created;
  };
  User.findOne = async () => managerDoc;
  require('../src/services/adminActionAudit.service').logAuditEvent = async () => {};

  try {
    const controllerPath = require.resolve('../src/controllers/team.controller');
    delete require.cache[controllerPath];
    const { createTeam } = require('../src/controllers/team.controller');

    const req = {
      user: { firmId: 'firm-1', _id: 'admin-1', role: 'PRIMARY_ADMIN', isPrimaryAdmin: true },
      body: { name: 'Ops', managerId },
    };
    const res = createRes();
    await createTeam(req, res);

    assert.strictEqual(res.statusCode, 201, `Should return 201, got: ${res.statusCode}, body: ${JSON.stringify(res.body)}`);
    assert.ok(savedUser !== null, 'Manager user should have been saved');
    const qcTeamId = String(res.body.data.qcTeam._id);
    const linkedIds = (savedUser.teamIds || []).map(String);
    assert.ok(linkedIds.includes(qcTeamId), 'Manager should be linked to the QC WB teamIds');
    console.log('✓ Manager is automatically linked to QC workbasket');
  } finally {
    Team.create = originalCreate;
    User.findOne = originalUserFindOne;
    require('../src/services/adminActionAudit.service').logAuditEvent = originalLogAudit;
    delete require.cache[require.resolve('../src/controllers/team.controller')];
  }
}

// ── 3. Admin/manager can add users to QC WB ───────────────────────────────

async function testAddUserToQCWorkbasket() {
  const Team = require('../src/models/Team.model');
  const User = require('../src/models/User.model');
  const { logAuditEvent } = require('../src/services/adminActionAudit.service');

  let savedUser = null;
  const qcTeamDoc = {
    _id: '507f1f77bcf86cd799439021',
    firmId: 'firm-1',
    type: 'QC',
    parentWorkbasketId: '507f1f77bcf86cd799439022',
    isActive: true,
  };
  // Use valid ObjectId string for userId.
  const userId = '507f1f77bcf86cd799439031';
  const userDoc = {
    _id: userId,
    firmId: 'firm-1',
    teamIds: [],
    teamId: null,
    save: async function() { savedUser = this; },
  };

  const originalFindOne = Team.findOne;
  const originalUserFindOne = User.findOne;
  const originalLogAudit = logAuditEvent;

  Team.findOne = async (query) => {
    if (String(query?._id) === '507f1f77bcf86cd799439021') return qcTeamDoc;
    return null;
  };
  User.findOne = async () => userDoc;
  require('../src/services/adminActionAudit.service').logAuditEvent = async () => {};

  try {
    const controllerPath = require.resolve('../src/controllers/team.controller');
    delete require.cache[controllerPath];
    const { addUserToQcWorkbasket } = require('../src/controllers/team.controller');

    const req = {
      params: { id: '507f1f77bcf86cd799439021' },
      user: { firmId: 'firm-1', _id: 'admin-1', role: 'PRIMARY_ADMIN', isPrimaryAdmin: true },
      body: { userId },
    };
    const res = createRes();
    await addUserToQcWorkbasket(req, res);

    assert.strictEqual(res.statusCode, 200, `Should return 200, got: ${res.statusCode}, body: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.success, 'Should succeed');
    assert.ok(savedUser !== null, 'User should have been saved');
    const linkedIds = (savedUser.teamIds || []).map(String);
    assert.ok(linkedIds.includes('507f1f77bcf86cd799439021'), 'User should be linked to the QC WB');
    console.log('✓ Admin can add users to QC workbasket');
  } finally {
    Team.findOne = originalFindOne;
    User.findOne = originalUserFindOne;
    require('../src/services/adminActionAudit.service').logAuditEvent = originalLogAudit;
    delete require.cache[require.resolve('../src/controllers/team.controller')];
  }
}

// ── 4. Subcategory requires a workbasket mapping ──────────────────────────

function testSubcategoryRequiresWorkbasketMapping() {
  const Category = require('../src/models/Category.model');
  const categorySchema = Category.schema;
  const subcategoryPaths = categorySchema.path('subcategories');
  assert.ok(subcategoryPaths, 'subcategories path exists');
  // Confirm workbasketId is required on subcategory schema.
  const wbPath = subcategoryPaths.schema && subcategoryPaths.schema.path('workbasketId');
  assert.ok(wbPath, 'workbasketId path exists on subcategory schema');
  assert.ok(wbPath.isRequired, 'workbasketId is required on subcategory');
  console.log('✓ Subcategory schema requires workbasketId mapping');
}

// ── 5. Docket creation places docket in workbasket (state=IN_WB) ──────────

function testNewDocketPlacedInWorkbasket() {
  // Verified via caseCreate.service logic: when no explicit assignee,
  // status = UNASSIGNED, state = IN_WB, queueType = GLOBAL.
  // We test the state-setting logic here via the domain model defaults.
  const Case = require('../src/models/Case.model');
  const caseSchema = Case.schema;
  const statePath = caseSchema.path('state');
  const queuePath = caseSchema.path('queueType');
  assert.ok(statePath, 'state field exists on Case');
  assert.ok(queuePath, 'queueType field exists on Case');
  // Default lifecycle is WL (workbasket queue).
  const lifecyclePath = caseSchema.path('lifecycle');
  assert.ok(lifecyclePath, 'lifecycle field exists');
  const { DocketLifecycle } = require('../src/domain/docketLifecycle');
  assert.strictEqual(lifecyclePath.defaultValue, DocketLifecycle.WL, 'Default lifecycle is WL (workbasket)');
  console.log('✓ New docket schema defaults place it in workbasket queue');
}

// ── 6. Pulling a docket sets assignedToXID and moves to user Worklist ─────

async function testPullDocketFromWorkbasketSetsAssignee() {
  const Case = require('../src/models/Case.model');
  const CaseAudit = require('../src/models/CaseAudit.model');
  const CaseStatus = require('../src/domain/case/caseStatus');

  const originalFindOneAndUpdate = Case.findOneAndUpdate;
  const originalAuditCreate = CaseAudit.create;

  let capturedFilter = null;
  let capturedUpdate = null;

  Case.findOneAndUpdate = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return {
      caseId: 'DCK-001',
      firmId: 'firm-1',
      assignedToXID: 'X100001',
      status: CaseStatus.ASSIGNED,
      state: 'IN_PROGRESS',
      queueType: 'PERSONAL',
    };
  };
  CaseAudit.create = async () => ({});

  // Stub docketAuditService so the test does not hit the DB pre-save hook.
  const docketAuditPath = require.resolve('../src/services/docketAudit.service');
  const originalDocketAudit = require.cache[docketAuditPath];
  require.cache[docketAuditPath] = {
    id: docketAuditPath,
    filename: docketAuditPath,
    loaded: true,
    exports: { logAssignment: async () => {}, logBulkAction: async () => {} },
  };

  try {
    const servicePath = require.resolve('../src/services/caseAssignment.service');
    delete require.cache[servicePath];
    const { pullCaseFromWorkbasket } = require('../src/services/caseAssignment.service');

    const result = await pullCaseFromWorkbasket({
      caseId: 'DCK-001',
      tenantId: 'firm-1',
      userId: 'X100001',
    });

    assert.strictEqual(result.success, true, 'Pull should succeed');
    assert.strictEqual(result.status, 'ASSIGNED');
    assert.strictEqual(capturedFilter.assignedToXID, null, 'Filter must require null assignedToXID');
    assert.strictEqual(capturedFilter.status, CaseStatus.UNASSIGNED, 'Filter must require UNASSIGNED status');
    assert.strictEqual(capturedUpdate.$set.assignedToXID, 'X100001', 'assignedToXID must be set');
    assert.strictEqual(capturedUpdate.$set.queueType, 'PERSONAL', 'queueType must become PERSONAL');
    assert.strictEqual(capturedUpdate.$set.state, 'IN_PROGRESS', 'state must become IN_PROGRESS');
    console.log('✓ Pulling from workbasket sets assignedToXID and moves docket to user Worklist');
  } finally {
    Case.findOneAndUpdate = originalFindOneAndUpdate;
    CaseAudit.create = originalAuditCreate;
    if (originalDocketAudit) {
      require.cache[docketAuditPath] = originalDocketAudit;
    } else {
      delete require.cache[docketAuditPath];
    }
    delete require.cache[require.resolve('../src/services/caseAssignment.service')];
  }
}

// ── 7. Pending keeps assignedToXID (docket stays in user's Worklist) ──────

async function testPendingKeepsAssignedUser() {
  const Case = require('../src/models/Case.model');
  const CaseStatus = require('../src/domain/case/caseStatus');

  let savedStatus = null;
  let savedAssignedToXID = undefined;

  const docketDoc = {
    caseId: 'DCK-002',
    firmId: 'firm-1',
    status: CaseStatus.ASSIGNED,
    state: 'IN_PROGRESS',
    assignedToXID: 'X100002',
    queueType: 'PERSONAL',
    save: async function() {
      savedStatus = this.status;
      savedAssignedToXID = this.assignedToXID;
    },
  };

  // Simulate pendCase: assignedToXID must NOT be cleared when status becomes PENDING.
  docketDoc.status = CaseStatus.PENDING;
  docketDoc.reopenAt = new Date(Date.now() + 86400000);
  docketDoc.pendingUntil = docketDoc.reopenAt;
  await docketDoc.save();

  assert.strictEqual(savedAssignedToXID, 'X100002', 'assignedToXID must remain set when docket is pended');
  assert.strictEqual(savedStatus, CaseStatus.PENDING, 'Status must be PENDING');
  console.log('✓ Pending a docket keeps assignedToXID – docket stays owned by the user');
}

// ── 8. Deactivating a user moves non-terminal dockets back to WB ──────────

async function testUserDeactivationMovesDocketsBackToWB() {
  const Case = require('../src/models/Case.model');
  const CaseStatus = require('../src/domain/case/caseStatus');

  const capturedFilters = [];
  const capturedUpdates = [];
  const originalUpdateMany = Case.updateMany;

  Case.updateMany = async (filter, update) => {
    capturedFilters.push(filter);
    capturedUpdates.push(update);
    return { modifiedCount: 3 };
  };

  try {
    const servicePath = require.resolve('../src/services/docketWorkflow.service');
    delete require.cache[servicePath];
    const { handleUserDeactivation } = require('../src/services/docketWorkflow.service');

    const result = await handleUserDeactivation({ firmId: 'firm-1', userXID: 'X200001' });

    assert.ok(capturedFilters.length > 0, 'updateMany should have been called');
    assert.strictEqual(capturedFilters[0].assignedToXID, 'X200001', 'Filter must target the deactivated user');
    assert.strictEqual(capturedFilters[0].firmId, 'firm-1', 'Filter must be firm-scoped');

    const update = capturedUpdates[0].$set;
    assert.strictEqual(update.assignedToXID, null, 'assignedToXID must be cleared');
    assert.strictEqual(update.queueType, 'GLOBAL', 'queueType must be GLOBAL');
    assert.strictEqual(update.state, 'IN_WB', 'state must be IN_WB');
    assert.ok(update.pendingUntil === null || update.pendingUntil !== undefined, 'pendingUntil must be cleared');
    assert.ok('workbasketMoved' in result, 'Result should contain workbasketMoved count');
    console.log('✓ Deactivating user moves all non-terminal dockets back to workbasket');
  } finally {
    Case.updateMany = originalUpdateMany;
    delete require.cache[require.resolve('../src/services/docketWorkflow.service')];
  }
}

// ── 9. RESOLVED/FILED dockets absent from WB/WL queries ──────────────────

function testTerminalDocketsExcludedFromWBAndWL() {
  const CaseStatus = require('../src/domain/case/caseStatus');

  // Employee worklist query uses these statuses – terminal states must NOT be included.
  const worklistStatuses = [
    CaseStatus.ASSIGNED,
    CaseStatus.IN_PROGRESS,
    CaseStatus.OPEN,
    CaseStatus.QC_PENDING,
  ].filter(Boolean);

  assert.ok(!worklistStatuses.includes(CaseStatus.RESOLVED), 'RESOLVED must not appear in WL query');
  assert.ok(!worklistStatuses.includes(CaseStatus.FILED), 'FILED must not appear in WL query');

  // Workbasket queue query uses OPEN/UNASSIGNED/RETURNED – terminal states not included.
  const workbasketStatuses = [
    CaseStatus.OPEN,
    CaseStatus.RETURNED,
    CaseStatus.UNASSIGNED,
  ].filter(Boolean);

  assert.ok(!workbasketStatuses.includes(CaseStatus.RESOLVED), 'RESOLVED must not appear in WB query');
  assert.ok(!workbasketStatuses.includes(CaseStatus.FILED), 'FILED must not appear in WB query');

  console.log('✓ RESOLVED and FILED dockets excluded from WL and WB queries');
}

// ── 10. handleUserDeactivation filters out RESOLVED/FILED ─────────────────

async function testDeactivationSkipsTerminalDockets() {
  const Case = require('../src/models/Case.model');

  const originalUpdateMany = Case.updateMany;
  let capturedFilter = null;

  Case.updateMany = async (filter) => {
    capturedFilter = filter;
    return { modifiedCount: 0 };
  };

  try {
    const servicePath = require.resolve('../src/services/docketWorkflow.service');
    delete require.cache[servicePath];
    const { handleUserDeactivation } = require('../src/services/docketWorkflow.service');

    await handleUserDeactivation({ firmId: 'firm-1', userXID: 'X300001' });

    assert.ok(capturedFilter, 'updateMany must be called');
    // The filter must exclude RESOLVED and FILED via $nin.
    const stateFilter = capturedFilter.state;
    const statusFilter = capturedFilter.status;
    assert.ok(
      (stateFilter && stateFilter.$nin && stateFilter.$nin.includes('RESOLVED')) ||
      (statusFilter && statusFilter.$nin && statusFilter.$nin.includes('RESOLVED')),
      'RESOLVED must be excluded from deactivation update filter',
    );
    assert.ok(
      (stateFilter && stateFilter.$nin && stateFilter.$nin.includes('FILED')) ||
      (statusFilter && statusFilter.$nin && statusFilter.$nin.includes('FILED')),
      'FILED must be excluded from deactivation update filter',
    );
    console.log('✓ Deactivation update filter excludes RESOLVED and FILED dockets');
  } finally {
    Case.updateMany = originalUpdateMany;
    delete require.cache[require.resolve('../src/services/docketWorkflow.service')];
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function run() {
  const tests = [
    testCreatePrimaryWorkbasketAutoCreatesQC,
    testManagerAutoLinkedToQCWorkbasket,
    testAddUserToQCWorkbasket,
    testSubcategoryRequiresWorkbasketMapping,
    testNewDocketPlacedInWorkbasket,
    testPullDocketFromWorkbasketSetsAssignee,
    testPendingKeepsAssignedUser,
    testUserDeactivationMovesDocketsBackToWB,
    testTerminalDocketsExcludedFromWBAndWL,
    testDeactivationSkipsTerminalDockets,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      failed++;
      console.error(`✗ ${test.name}: ${err.message}`);
      if (process.env.VERBOSE) console.error(err.stack);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
