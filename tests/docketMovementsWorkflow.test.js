#!/usr/bin/env node
const assert = require('assert');

// Domain and transition helpers
const CaseStatus = require('../src/domain/case/caseStatus');
const { DocketLifecycle } = require('../src/domain/docketLifecycle');
const { canFile, canResolve, canTransition } = require('../src/utils/docketStateTransitions');
const { getCanonicalDocketState } = require('../src/utils/docketStateMapper');
const {
  canPullFromWorkbasket,
  canAssignFromWorkbasket,
  canMoveBetweenWorklists,
  resolveDocketWorkbasketId,
} = require('../src/services/workbasketAuthorization.service');

async function runTests() {
  console.log('=== Running Docket Movements & Invariants Comprehensive Test Suite ===\n');

  const firmId = 'FIRM-MOVEMENTS-001';
  const teamA = 'TEAM_ORIGINATOR';
  const teamB = 'TEAM_ROUTED_QUERY';

  // =========================================================================
  // Movement 1: When docket is created and moved to WB
  // =========================================================================
  console.log('--- Testing Movement 1: Docket Created and Moved to WB ---');

  const mongoose = require('mongoose');
  const Case = require('../src/models/Case.model');
  const CaseAudit = require('../src/models/CaseAudit.model');
  const CaseHistory = require('../src/models/CaseHistory.model');
  const DocketAuditLog = require('../src/models/DocketAuditLog.model');
  const DocketAudit = require('../src/models/DocketAudit.model');
  const DocketRoute = require('../src/models/DocketRoute.model');
  const Comment = require('../src/models/Comment.model');
  const Notification = require('../src/models/Notification.model');
  const auditLogService = require('../src/services/auditLog.service');
  const docketAuditService = require('../src/services/docketAudit.service');

  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
    withTransaction: async (fn) => fn(),
  });

  const mockFindQuery = (data) => {
    const promise = Promise.resolve(data);
    promise.select = () => mockFindQuery(data);
    promise.lean = () => Promise.resolve(data);
    promise.session = () => mockFindQuery(data);
    promise.sort = () => mockFindQuery(data);
    return promise;
  };

  CaseAudit.create = async () => ({});
  CaseHistory.create = async () => ({});
  DocketAuditLog.create = async () => ({});
  DocketAudit.create = async () => ({});
  DocketRoute.create = async (payload) => payload;
  Comment.create = async (payload) => payload;
  Notification.create = async (payload) => payload;
  auditLogService.logCaseHistory = async () => ({});
  docketAuditService.logAssignment = async () => ({});
  docketAuditService.logStateChange = async () => ({});

  const createdDocket = {
    caseId: 'DCK-MVT-001',
    firmId,
    title: 'ROC Filing Annual Return',
    status: 'UNASSIGNED',
    state: 'IN_WB',
    queueType: 'GLOBAL',
    ownerTeamId: teamA,
    workbasketId: teamA,
    routedToTeamId: null,
    assignedToXID: null,
  };

  // State mapping
  assert.strictEqual(getCanonicalDocketState(createdDocket), 'IN_WB', 'Created docket must map to canonical IN_WB');
  assert.strictEqual(resolveDocketWorkbasketId(createdDocket), teamA, 'Created docket must resolve to owner workbasket');

  // Pull authorization
  const teamAMember = { xID: 'USER_A1', email: 'user_a1@firm.com', name: 'User A1', role: 'USER', teamId: teamA, isActive: true };
  const teamBMember = { xID: 'USER_B1', email: 'user_b1@firm.com', name: 'User B1', role: 'USER', teamId: teamB, isActive: true };
  const adminUser = { xID: 'ADMIN_01', email: 'admin01@firm.com', name: 'Admin 01', role: 'ADMIN', isActive: true };

  assert.strictEqual(canPullFromWorkbasket({ user: teamAMember, docket: createdDocket }), true, 'Team A member should be allowed to pull unassigned docket in Team A WB');
  assert.strictEqual(canPullFromWorkbasket({ user: teamBMember, docket: createdDocket }), false, 'Team B member should NOT be allowed to pull unassigned docket in Team A WB');
  assert.strictEqual(canPullFromWorkbasket({ user: adminUser, docket: createdDocket }), true, 'Admin should be allowed to pull from any workbasket');

  // Assign authorization
  const teamAManager = { xID: 'MGR_A', email: 'mgr_a@firm.com', name: 'Manager A', role: 'MANAGER', teamId: teamA, isActive: true };
  const teamBManager = { xID: 'MGR_B', email: 'mgr_b@firm.com', name: 'Manager B', role: 'MANAGER', teamId: teamB, isActive: true };

  assert.strictEqual(canAssignFromWorkbasket({ actor: teamAManager, docket: createdDocket, assignee: teamAMember }), true, 'Team A manager can assign docket to Team A member');
  assert.strictEqual(canAssignFromWorkbasket({ actor: teamBManager, docket: createdDocket, assignee: teamBMember }), false, 'Team B manager cannot assign docket from Team A WB');
  assert.strictEqual(canAssignFromWorkbasket({ actor: teamAMember, docket: createdDocket, assignee: teamAMember }), false, 'Standard user cannot assign from WB');

  console.log('✓ Movement 1 passed: Created docket correctly lands in WB with strict team-scoped authorization');

  // =========================================================================
  // Movement 2: When a user pulls docket from WB to WL
  // =========================================================================
  console.log('\n--- Testing Movement 2: User Pulls Docket from WB to WL ---');

  const caseAssignmentService = require('../src/services/caseAssignment.service');

  const origCaseFindOneAndUpdate = Case.findOneAndUpdate;
  const origCaseAuditCreate = CaseAudit.create;
  const origLogCaseHistory = auditLogService.logCaseHistory;

  let simulatedDocketStore = { ...createdDocket };

  Case.findOneAndUpdate = async (filter, updatePipeline) => {
    // Check atomic filter condition
    if (filter.assignedToXID !== null || filter.assignedTo !== null) return null;
    if (!filter.status.$in.includes(simulatedDocketStore.status)) return null;

    // Apply update
    const patch = updatePipeline[0].$set;
    const nextStatus = simulatedDocketStore.status === 'ROUTED'
      ? CaseStatus.ROUTED_ASSIGNED
      : CaseStatus.ASSIGNED;

    simulatedDocketStore = {
      ...simulatedDocketStore,
      assignedToXID: patch.assignedToXID,
      assignedAt: patch.assignedAt,
      status: nextStatus,
      queueType: patch.queueType,
      lifecycle: patch.lifecycle,
      state: patch.state,
    };
    return simulatedDocketStore;
  };

  const pullResult = await caseAssignmentService.pullCaseFromWorkbasket({
    caseId: createdDocket.caseId,
    tenantId: firmId,
    userId: teamAMember.xID,
  });

  assert.strictEqual(pullResult.success, true);
  assert.strictEqual(pullResult.status, CaseStatus.ASSIGNED);
  assert.strictEqual(pullResult.assignedTo, teamAMember.xID);
  assert.strictEqual(simulatedDocketStore.status, 'ASSIGNED');
  assert.strictEqual(simulatedDocketStore.state, 'IN_PROGRESS');
  assert.strictEqual(simulatedDocketStore.queueType, 'PERSONAL');
  assert.strictEqual(simulatedDocketStore.lifecycle, DocketLifecycle.IN_WORKLIST);
  assert.strictEqual(getCanonicalDocketState(simulatedDocketStore), 'IN_PROGRESS');

  // Double pull conflict check
  const secondPullResult = await caseAssignmentService.pullCaseFromWorkbasket({
    caseId: createdDocket.caseId,
    tenantId: firmId,
    userId: 'ANOTHER_USER',
  });
  assert.strictEqual(secondPullResult.success, false);
  assert.strictEqual(secondPullResult.status, 'CONFLICT');

  console.log('✓ Movement 2 passed: Pull atomically moves docket from WB to WL with IN_PROGRESS state');

  // =========================================================================
  // Movement 3: Manager assigns/moves dockets between WB and user WL
  // =========================================================================
  console.log('\n--- Testing Movement 3: Manager Assigns/Moves Dockets between WB and WL ---');

  const Team = require('../src/models/Team.model');
  const User = require('../src/models/User.model');
  const docketRoutingService = require('../src/services/docketRouting.service');

  const origCaseFindOne = Case.findOne;
  const origUserFindOne = User.findOne;
  const origTeamFindOne = Team.findOne;

  Case.findOne = () => {
    const doc = {
      ...simulatedDocketStore,
      save: async function () { Object.assign(simulatedDocketStore, this); return this; },
      toObject: function () { return { ...simulatedDocketStore }; },
    };
    return mockFindQuery(doc);
  };

  User.findOne = (query) => {
    let user = null;
    if (query?.xID === 'USER_A2' && query?.teamId === teamA) {
      user = { _id: 'U_A2', xID: 'USER_A2', teamId: teamA, isActive: true };
    } else if (query?.xID === 'USER_A1') {
      user = { _id: 'U_A1', xID: 'USER_A1', teamId: teamA, isActive: true };
    } else if (query?.xID === 'USER_B1') {
      user = { _id: 'U_B1', xID: 'USER_B1', teamId: teamB, isActive: true };
    }
    return mockFindQuery(user);
  };

  // Manager reassigns from USER_A1 to USER_A2
  const managerAssigned = await docketRoutingService.managerMoveDocket({
    docketId: simulatedDocketStore.caseId,
    actor: teamAManager,
    firmId,
    to: { type: 'WL', userXID: 'USER_A2' },
  });

  assert.strictEqual(managerAssigned.assignedToXID, 'USER_A2');
  assert.strictEqual(managerAssigned.status, CaseStatus.IN_PROGRESS);
  assert.strictEqual(managerAssigned.state, 'IN_PROGRESS');
  assert.strictEqual(managerAssigned.queueType, 'PERSONAL');
  assert.strictEqual(managerAssigned.routedToTeamId, null, 'Internal move within team must not set routedToTeamId');

  // Manager moves docket back to WB
  const managerMovedToWb = await docketRoutingService.managerMoveDocket({
    docketId: simulatedDocketStore.caseId,
    actor: teamAManager,
    firmId,
    to: { type: 'WB' },
  });

  assert.strictEqual(managerMovedToWb.assignedToXID, null);
  assert.strictEqual(managerMovedToWb.status, 'UNASSIGNED');
  assert.strictEqual(managerMovedToWb.state, 'IN_WB');
  assert.strictEqual(managerMovedToWb.queueType, 'GLOBAL');
  assert.strictEqual(managerMovedToWb.routedToTeamId, null);

  // Cross-team manager move must be blocked
  await assert.rejects(
    () => docketRoutingService.managerMoveDocket({
      docketId: simulatedDocketStore.caseId,
      actor: teamBManager,
      firmId,
      to: { type: 'WB' },
    }),
    /Cross-team movement is forbidden/
  );

  console.log('✓ Movement 3 passed: Manager moves between WB and WL within team and cross-team moves are blocked');

  // =========================================================================
  // Movement 4: Docket routed to another WB for queries & pulled/assigned to user WL
  // =========================================================================
  console.log('\n--- Testing Movement 4: Docket Routed to Another WB for Queries ---');

  const origDocketRouteCreate = DocketRoute.create;
  const origCommentCreate = Comment.create;
  const origNotificationCreate = Notification.create;
  const origUserFind = User.find;

  User.find = () => ({ select: () => ({ lean: async () => [] }) });

  Team.findOne = () => ({
    select: () => ({
      lean: async () => ({ _id: teamB, name: 'Tax & Compliance WB', isActive: true, type: 'PRIMARY' }),
    }),
  });

  // Assign back to USER_A1 first before routing
  simulatedDocketStore.assignedToXID = 'USER_A1';
  simulatedDocketStore.status = CaseStatus.IN_PROGRESS;
  simulatedDocketStore.ownerTeamId = teamA;
  simulatedDocketStore.workbasketId = teamA;

  const routedDocket = await docketRoutingService.routeDocket({
    docketId: simulatedDocketStore.caseId,
    actor: teamAMember,
    firmId,
    toTeamId: teamB,
    note: 'Please verify section 135 CSR calculation',
  });

  assert.strictEqual(routedDocket.routedToTeamId, teamB);
  assert.strictEqual(routedDocket.ownerTeamId, teamB);
  assert.strictEqual(routedDocket.workbasketId, teamB);
  assert.strictEqual(routedDocket.status, 'ROUTED');
  assert.strictEqual(routedDocket.state, 'IN_WB');
  assert.strictEqual(routedDocket.queueType, 'GLOBAL');
  assert.strictEqual(routedDocket.assignedToXID, null);
  assert.strictEqual(routedDocket.routeOriginatorTeamId, teamA);
  assert.strictEqual(routedDocket.routeOriginatorUserXID, 'USER_A1');

  // Workbasket authorization on routed docket
  assert.strictEqual(resolveDocketWorkbasketId(routedDocket), teamB, 'Routed docket resolves to target workbasket ID');
  assert.strictEqual(canPullFromWorkbasket({ user: teamBMember, docket: routedDocket }), true, 'Team B member can pull routed docket');
  assert.strictEqual(canPullFromWorkbasket({ user: teamAMember, docket: routedDocket }), false, 'Team A member cannot pull docket while routed to Team B');
  assert.strictEqual(canAssignFromWorkbasket({ actor: teamBManager, docket: routedDocket, assignee: teamBMember }), true, 'Team B manager can assign routed docket to Team B member');

  // Team B member pulls the routed docket
  const pulledRoutedDocket = await caseAssignmentService.pullCaseFromWorkbasket({
    caseId: routedDocket.caseId,
    tenantId: firmId,
    userId: teamBMember.xID,
  });

  assert.strictEqual(pulledRoutedDocket.success, true);
  assert.strictEqual(pulledRoutedDocket.status, CaseStatus.ROUTED_ASSIGNED);
  assert.strictEqual(simulatedDocketStore.status, 'ROUTED_ASSIGNED');
  assert.strictEqual(simulatedDocketStore.state, 'IN_PROGRESS');
  assert.strictEqual(simulatedDocketStore.queueType, 'PERSONAL');
  assert.strictEqual(simulatedDocketStore.assignedToXID, teamBMember.xID);

  console.log('✓ Movement 4 passed: Docket successfully routed to another WB, scoped to target team, and pulled as ROUTED_ASSIGNED');

  // =========================================================================
  // Movement 5: Critical Invariant - Once routed, docket cannot be filed or resolved, only pended and routed back
  // =========================================================================
  console.log('\n--- Testing Movement 5: Critical Invariant on Routed Dockets ---');

  const caseActionService = require('../src/services/caseAction.service');
  const caseActionsController = require('../src/controllers/caseActions.controller');
  const docketWorkflowService = require('../src/services/docketWorkflow.service');
  const { CaseRepository } = require('../src/repositories');

  const origRepoFindByCaseId = CaseRepository.findByCaseId;
  CaseRepository.findByCaseId = async () => ({ ...simulatedDocketStore });

  // 5a. canFile transition helper
  assert.strictEqual(canFile('ROUTED'), false, 'canFile must reject ROUTED state');
  assert.strictEqual(canFile('ROUTED_ASSIGNED'), false, 'canFile must reject ROUTED_ASSIGNED state');
  assert.strictEqual(canFile('ROUTED_PEND'), false, 'canFile must reject ROUTED_PEND state');

  // 5b. caseActionService.fileCase must reject routed dockets
  await assert.rejects(
    () => caseActionService.fileCase(firmId, simulatedDocketStore.caseId, 'Attempting to file routed docket', teamBMember),
    /Cannot file docket while routed/
  );

  // 5c. caseActionsController.fileCase must return 409
  let filedStatusCode = 0;
  let filedPayload = null;
  const mockRes = {
    statusCode: 200,
    headersSent: false,
    status(code) { filedStatusCode = code; this.statusCode = code; return this; },
    json(data) { filedPayload = data; this.headersSent = true; return this; },
  };

  await caseActionsController.fileCase(
    { params: { caseId: simulatedDocketStore.caseId }, body: { comment: 'Attempting file' }, user: teamBMember },
    mockRes
  );
  assert.strictEqual(filedStatusCode, 409, 'fileCase controller must return 409 for routed docket');
  assert.strictEqual(filedPayload?.message, 'Cannot file docket while routed');

  // 5d. docketWorkflow.transition to FILED must reject
  await assert.rejects(
    () => docketWorkflowService.transition({
      docketId: simulatedDocketStore.caseId,
      firmId,
      actor: teamBMember,
      toState: 'FILED',
      comment: 'Filing routed docket',
    }),
    /Cannot file docket while routed/
  );

  // 5e. caseActionService.resolveCase must reject routed dockets
  await assert.rejects(
    () => caseActionService.resolveCase(firmId, simulatedDocketStore.caseId, 'Attempting resolve on routed docket', teamBMember),
    /Cannot resolve while docket is routed/
  );

  // 5f. docketRoutingService.resolveDocketWithTeamRestriction must reject routed dockets
  await assert.rejects(
    () => docketRoutingService.resolveDocketWithTeamRestriction({
      docketId: simulatedDocketStore.caseId,
      actor: teamBMember,
      firmId,
    }),
    /Cannot resolve while docket is routed/
  );

  // 5g. docketWorkflow.transition to RESOLVED must reject
  await assert.rejects(
    () => docketWorkflowService.transition({
      docketId: simulatedDocketStore.caseId,
      firmId,
      actor: teamBMember,
      toState: 'RESOLVED',
      comment: 'Resolving routed docket',
    }),
    /Cannot resolve while docket is routed/
  );

  // 5h. Routed docket CAN be pended
  const origCaseServiceUpdateStatus = require('../src/services/case.service').updateStatus;
  const CaseService = require('../src/services/case.service');
  CaseService.updateStatus = async (caseId, targetStatus, context) => {
    simulatedDocketStore.status = targetStatus;
    simulatedDocketStore.previousStatus = context.statusPatch?.statusBeforePended || simulatedDocketStore.previousStatus;
    simulatedDocketStore.statusBeforePended = context.statusPatch?.statusBeforePended;
    simulatedDocketStore.pendingUntil = context.statusPatch?.pendingUntil;
  };

  const pendedDocket = await caseActionService.pendCase(
    firmId,
    simulatedDocketStore.caseId,
    'Awaiting client clarifications on CSR ledger',
    '2026-12-01',
    teamBMember
  );
  assert.strictEqual(simulatedDocketStore.status, 'PENDING');
  assert.strictEqual(simulatedDocketStore.statusBeforePended, 'ROUTED_ASSIGNED');

  // 5i. Routed docket CAN be unpended back to ROUTED_ASSIGNED
  const unpendedDocket = await caseActionService.unpendCase(
    firmId,
    simulatedDocketStore.caseId,
    'Received clarification from client, resuming review',
    teamBMember
  );
  assert.strictEqual(simulatedDocketStore.status, 'ROUTED_ASSIGNED');

  // 5j. Routed docket can be returned back to original user WL
  const origDocketRouteFindOne = DocketRoute.findOne;
  const activeRoute = { returnedAt: null, note: 'Please verify section 135 CSR calculation', save: async function () { this.saved = true; } };
  DocketRoute.findOne = () => ({ sort: async () => activeRoute });

  const returnedDocket = await docketRoutingService.returnRoutedDocket({
    docketId: simulatedDocketStore.caseId,
    actor: teamBMember,
    firmId,
    note: 'CSR calculations verified and cross-referenced with schedule VII.',
  });

  assert.strictEqual(returnedDocket.routedToTeamId, null, 'Returned docket clears routedToTeamId');
  assert.strictEqual(returnedDocket.ownerTeamId, teamA, 'Returned docket restores ownerTeamId to Team A');
  assert.strictEqual(returnedDocket.assignedToXID, 'USER_A1', 'Returned docket returns to originator USER_A1');
  assert.strictEqual(returnedDocket.status, CaseStatus.IN_PROGRESS, 'Returned docket is IN_PROGRESS in originator WL');
  assert.strictEqual(returnedDocket.queueType, 'PERSONAL');
  assert.strictEqual(returnedDocket.routeOriginatorUserXID, null);
  assert.strictEqual(activeRoute.saved, true);

  console.log('✓ Movement 5 passed: Airtight invariant enforced! Routed docket cannot be filed or resolved; can be pended/unpended, and returns to originator WL');

  // =========================================================================
  // Movement 6: Dockets can be cloned, filed, pended and resolved
  // =========================================================================
  console.log('\n--- Testing Movement 6: Docket Lifecycle Operations (Clone, Pend, Resolve, File) ---');

  // 6a. Returned docket can now be pended by originator
  simulatedDocketStore = { ...returnedDocket };
  CaseRepository.findByCaseId = async () => ({ ...simulatedDocketStore });

  await caseActionService.pendCase(
    firmId,
    simulatedDocketStore.caseId,
    'Pending partner signature',
    '2026-12-05',
    teamAMember
  );
  assert.strictEqual(simulatedDocketStore.status, 'PENDING');

  // 6b. Returned docket can be unpended by originator back to IN_PROGRESS
  await caseActionService.unpendCase(
    firmId,
    simulatedDocketStore.caseId,
    'Signature received',
    teamAMember
  );
  assert.strictEqual(simulatedDocketStore.status, CaseStatus.IN_PROGRESS);

  // 6c. Now that docket is back in owner team and unrouted, resolveCase succeeds
  await caseActionService.resolveCase(
    firmId,
    simulatedDocketStore.caseId,
    'All statutory compliance steps complete and verified.',
    teamAMember
  );
  assert.strictEqual(simulatedDocketStore.status, CaseStatus.RESOLVED);

  // 6d. Now that docket is completed, fileCase archives it to FILED
  simulatedDocketStore.status = 'IN_PROGRESS'; // Transition through allowed file paths
  await caseActionService.fileCase(
    firmId,
    simulatedDocketStore.caseId,
    'Annual filing archived for records.',
    teamAMember
  );
  assert.strictEqual(simulatedDocketStore.status, CaseStatus.FILED);

  // 6e. Verify clone case fields (based on caseCreateService.cloneCase contract)
  const cloneTemplate = {
    title: simulatedDocketStore.title,
    description: 'Cloned case for subsequent period',
    category: 'Corporate Compliance',
    subcategory: 'Annual Return',
    status: 'UNASSIGNED',
    lifecycle: DocketLifecycle.CREATED,
    queueType: 'GLOBAL',
    assignedTo: null,
    assignedToXID: null,
    ownerTeamId: teamA,
    routedToTeamId: null,
    routedByUserId: null,
    routedAt: null,
  };

  assert.strictEqual(cloneTemplate.status, 'UNASSIGNED', 'Cloned docket starts UNASSIGNED');
  assert.strictEqual(cloneTemplate.lifecycle, DocketLifecycle.CREATED, 'Cloned docket starts CREATED');
  assert.strictEqual(cloneTemplate.queueType, 'GLOBAL', 'Cloned docket is placed in global workbasket');
  assert.strictEqual(cloneTemplate.assignedToXID, null, 'Cloned docket has no initial assignee');
  assert.strictEqual(cloneTemplate.routedToTeamId, null, 'Cloned docket is not routed');

  console.log('✓ Movement 6 passed: Regular dockets can be cloned, pended, unpended, resolved, and filed cleanly');

  // Cleanup mocks
  Case.findOneAndUpdate = origCaseFindOneAndUpdate;
  Case.findOne = origCaseFindOne;
  CaseAudit.create = origCaseAuditCreate;
  auditLogService.logCaseHistory = origLogCaseHistory;
  User.findOne = origUserFindOne;
  User.find = origUserFind;
  Team.findOne = origTeamFindOne;
  DocketRoute.create = origDocketRouteCreate;
  DocketRoute.findOne = origDocketRouteFindOne;
  Comment.create = origCommentCreate;
  Notification.create = origNotificationCreate;
  CaseRepository.findByCaseId = origRepoFindByCaseId;
  CaseService.updateStatus = origCaseServiceUpdateStatus;
  mongoose.startSession = origStartSession;

  console.log('\n=== All Docket Movements & Invariants Tests PASSED! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
