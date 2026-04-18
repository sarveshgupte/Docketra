const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Case = require('../models/Case.model');
const Category = require('../models/Category.model');
const Team = require('../models/Team.model');
const docketAuditService = require('./docketAudit.service');
const { DocketStatus, toDocketState, toPersistenceState } = require('../domain/docket/docketStateMachine');
const {
  DocketLifecycle,
  assertValidLifecycleTransition,
  normalizeLifecycle,
  isValidTransition,
  getNextStates,
  toLifecycleFromStatus,
} = require('../domain/docketLifecycle');
const { EVENT_NAMES, emitDocketEvent } = require('./docketEvents.service');
const { NotificationTypes, createNotification } = require('../domain/notifications');
const { CASE_LOCK_CONFIG } = require('../config/constants');
const { logActivitySafe } = require('./docketActivity.service');
const { getCanonicalDocketState } = require('../utils/docketStateMapper');
const { canTransition } = require('../utils/docketStateTransitions');

const QC_DECISIONS = Object.freeze({
  APPROVED: 'APPROVED',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  CORRECTED: 'CORRECTED',
});

function getQcDecisionTransition(fromCanonicalState, decision) {
  const fromState = String(fromCanonicalState || '').toUpperCase();
  const normalizedDecision = String(decision || '').toUpperCase();
  if (fromState !== 'IN_QC') {
    throw makeError('QC can only be performed when docket is in QC state');
  }
  if (!QC_DECISIONS[normalizedDecision]) {
    throw makeError('Invalid QC decision');
  }

  if (normalizedDecision === QC_DECISIONS.FAILED) {
    return { state: 'IN_PROGRESS', qcOutcome: 'FAILED' };
  }
  if (normalizedDecision === QC_DECISIONS.CORRECTED) {
    return { state: 'RESOLVED', qcOutcome: 'CORRECTED' };
  }

  return { state: 'RESOLVED', qcOutcome: 'PASSED' };
}

function hydrateCanonicalDocketFields(docket) {
  if (!docket) return docket;
  docket.state = docket.state || getCanonicalDocketState(docket);
  if (docket.qcOutcome === undefined) docket.qcOutcome = null;
  return docket;
}

function validateOwnershipRules(docket) {
  if (!docket) return docket;

  if (docket.state === 'IN_WB' && docket.assignedToXID) {
    throw makeError('WB docket cannot have owner');
  }

  if (['IN_PROGRESS', 'IN_QC'].includes(docket.state) && !docket.assignedToXID) {
    throw makeError('Active/QC docket must have owner');
  }

  return docket;
}

function enforceOwnershipRules(docket) {
  if (!docket) return docket;

  if (docket.state === 'IN_WB') {
    docket.assignedToXID = null;
    docket.assignedTo = null;
    docket.queueType = 'GLOBAL';
  }

  if (docket.state === 'IN_PROGRESS') {
    if (!docket.assignedToXID) {
      throw makeError('IN_PROGRESS docket must have an owner');
    }
    docket.queueType = 'PERSONAL';
  }

  validateOwnershipRules(docket);
  return docket;
}

function makeError(message, statusCode = 400, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requireComment(comment, context) {
  if (!String(comment || '').trim()) {
    throw makeError(`${context} requires comment`, 400, 'COMMENT_REQUIRED');
  }
}

function lockHolderLabel(lockStatus = {}) {
  const display = String(lockStatus?.activeUserDisplayName || '').trim();
  const xid = String(lockStatus?.activeUserXID || '').trim().toUpperCase();
  const email = String(lockStatus?.activeUserEmail || '').trim().toLowerCase();
  if (display && xid) return `${display} (${xid})`;
  return display || xid || email || 'another user';
}

function assertNotLockedByAnotherActiveUser(docket, actor = {}) {
  const lockStatus = docket?.lockStatus || {};
  if (!lockStatus?.isLocked) return;

  const actorXID = String(actor?.xID || '').trim().toUpperCase();
  const ownerXID = String(lockStatus?.activeUserXID || '').trim().toUpperCase();
  if (actorXID && ownerXID && actorXID === ownerXID) return;

  const lockTs = new Date(lockStatus?.lastActivityAt || lockStatus?.lockedAt || 0).getTime();
  const isActiveLock = Number.isFinite(lockTs)
    && lockTs > 0
    && (Date.now() - lockTs) < CASE_LOCK_CONFIG.INACTIVITY_TIMEOUT_MS;
  if (!isActiveLock) return;

  throw makeError(
    `Docket is locked by ${lockHolderLabel(lockStatus)}. Ask them to exit or close the docket before moving it.`,
    409,
    'DOCKET_LOCKED_ACTIVE',
  );
}

function normalizeActorRole(actor = {}) {
  const raw = String(actor?.role || '').toUpperCase();
  if (raw === 'ADMIN' || raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'ADMIN';
  if (raw === 'SYSTEM') return 'SYSTEM';
  return 'USER';
}


function transitionLifecycle(docket, targetLifecycle, context = {}) {
  const { firmId, actor, docketId, suppressLifecycleNotification = false } = context;
  const fromLifecycle = normalizeLifecycle(docket.lifecycle || DocketLifecycle.CREATED);
  const toLifecycle = normalizeLifecycle(targetLifecycle);
  if (fromLifecycle !== toLifecycle) {
    assertValidLifecycleTransition(fromLifecycle, toLifecycle);
  }
  if (toLifecycle === DocketLifecycle.WL && !String(docket.assignedToXID || '').trim()) {
    throw makeError('Cannot move to WL without assignment', 400, 'WL_ASSIGNMENT_REQUIRED');
  }
  docket.lifecycle = toLifecycle;

  if (!suppressLifecycleNotification && fromLifecycle !== toLifecycle && firmId && docketId) {
    createDocketNotification({
      firmId,
      userId: docket.assignedToXID || actor?.xID,
      type: NotificationTypes.LIFECYCLE_CHANGED,
      docketId,
      actor: actor || { xID: 'SYSTEM', role: 'SYSTEM' },
    });
  }

  return toLifecycle;
}

function assignToUser(docket, userId) {
  docket.assignedToXID = String(userId || '').toUpperCase();
  docket.queueType = 'PERSONAL';
  docket.assignedAt = new Date();
  docket.updatedAt = new Date();
  docket.status = toPersistenceState(DocketStatus.ASSIGNED);
  docket.lifecycle = DocketLifecycle.IN_WORKLIST;
  docket.state = 'IN_PROGRESS';
  docket.qcOutcome = null;
  return docket;
}

async function createDocketNotification({ firmId, userId, type, docketId, actor }) {
  if (!userId) return;
  await createNotification({
    firmId,
    userId: String(userId || '').toUpperCase(),
    type,
    docketId,
    actor,
    timestamp: new Date(),
  });
}

function validateLifecycleAccess({ actor, fromLifecycle, toLifecycle, fromStatus }) {
  const role = normalizeActorRole(actor);
  const canonicalFromState = getCanonicalDocketState({ status: fromStatus });

  if (role === 'USER' && canonicalFromState === 'IN_QC') {
    throw makeError('Permission denied', 403, 'DOCKET_PERMISSION_DENIED');
  }

  if (!isValidTransition(fromLifecycle, toLifecycle)) {
    const allowedTargets = getNextStates(fromLifecycle);
    throw makeError(
      `Invalid lifecycle transition from ${fromLifecycle} to ${toLifecycle}. Allowed: ${allowedTargets.join(', ') || 'none'}`,
      400,
      'INVALID_DOCKET_TRANSITION',
    );
  }
}

async function writeAudit({
  docketId,
  fromState,
  toState,
  userId,
  comment = null,
  performedByRole = 'USER',
  firmId,
  action,
  metadata = {},
  requestId = null,
  changes = [],
  session = null,
}) {
  const canonicalEvent = String(metadata?.event || '').toUpperCase() === 'QC_ACTION'
    ? 'QC_ACTION'
    : 'STATE_CHANGED';
  const canonicalMetadata = canonicalEvent === 'QC_ACTION'
    ? { comment: comment || null, source: 'qcDecision' }
    : {
      action: action || null,
      requestId: requestId || metadata?.requestId || null,
    };

  await docketAuditService.logDocketEvent({
    docketId,
    firmId,
    event: canonicalEvent,
    userId,
    userRole: performedByRole,
    fromState,
    toState,
    qcOutcome: metadata?.qcOutcome || null,
    metadata: canonicalMetadata,
    session,
  });

  await docketAuditService.createLog({
    docketId,
    action,
    requestId: requestId || metadata?.requestId || randomUUID(),
    tenantId: firmId,
    fromState,
    toState,
    comment,
    performedByRole,
    performedBy: userId,
    changes,
    metadata: { ...metadata, comment, source: 'docketWorkflow.service.writeAudit' },
    firmId,
    session,
  });
}

async function pullFromWorkbench({ docketId, firmId, userId, userObjectId = null, assignToXID = null, session = null }) {
  const assigneeXID = String(assignToXID || userId || '').toUpperCase();
  if (!assigneeXID) throw makeError('assignee xID required');

  const filter = {
    caseId: docketId,
    firmId,
    status: toPersistenceState(DocketStatus.AVAILABLE),
    $or: [{ assignedToXID: null }, { assignedToXID: { $exists: false } }, { assignedToXID: '' }],
  };

  const update = {
    $set: {
      status: toPersistenceState(DocketStatus.ASSIGNED),
      lifecycle: DocketLifecycle.IN_WORKLIST,
      assignedToXID: assigneeXID,
      assignedTo: userObjectId || null,
      assignedAt: new Date(),
      lastActionByXID: String(userId || '').toUpperCase(),
      lastActionAt: new Date(),
      updatedAt: new Date(),
      queueType: 'PERSONAL',
      state: 'IN_PROGRESS',
      qcOutcome: null,
    },
    $inc: { version: 1 },
  };

  const updated = await Case.findOneAndUpdate(filter, update, {
    new: true,
    session,
  });

  if (!updated) {
    const existing = await Case.findOne({ caseId: docketId, firmId }).select('assignedToXID status state').lean();
    if (!existing) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');
    throw makeError('Docket is already assigned', 409, 'DOCKET_ALREADY_ASSIGNED');
  }

  await writeAudit({
    docketId,
    fromState: DocketStatus.AVAILABLE,
    toState: DocketStatus.ASSIGNED,
    userId,
    firmId,
    action: 'ASSIGNMENT',
    changes: [{
      field: 'assignedToXID',
      from: null,
      to: assigneeXID,
    }],
    metadata: { assigneeXID },
    session,
  });

  emitDocketEvent(EVENT_NAMES.ASSIGNMENT, { docketId, firmId, assigneeXID, assignedBy: userId });
  await createDocketNotification({
    firmId,
    userId: assigneeXID,
    type: NotificationTypes.ASSIGNED,
    docketId,
    actor: { xID: userId, role: 'USER' },
  });

  logActivitySafe({
    docketId: updated.caseInternalId,
    firmId,
    type: 'ASSIGNED',
    description: `Assigned to ${assigneeXID}`,
    metadata: { assigneeXID },
    performedByXID: userId,
  });

  return hydrateCanonicalDocketFields(updated);
}

async function transition({ docketId, firmId, actor, toState, comment, reopenAt, sendToQC = false, duplicateOf = null }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const docket = await Case.findOne({ caseId: docketId, firmId }).session(session);
      if (!docket) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');

      const fromState = toDocketState(docket.status);
      const fromCanonicalState = getCanonicalDocketState(docket);
      const normalizedTarget = toDocketState(toState);

      if ([DocketStatus.PENDING, DocketStatus.RESOLVED, DocketStatus.FILED].includes(normalizedTarget)) {
        requireComment(comment, normalizedTarget);
      }

      let finalTarget = normalizedTarget;
      if (normalizedTarget === DocketStatus.RESOLVED) {
        const category = docket.category
          ? await Category.findOne({ name: docket.category, firmId }).session(session).lean()
          : null;
        const forceQC = Boolean(docket.forceQc || category?.forceQC);
        if (forceQC || sendToQC) {
          finalTarget = DocketStatus.QC_PENDING;
          requireComment(comment, 'QC request');
        }
        docket.forceQc = Boolean(forceQC || sendToQC);
      }

      if (finalTarget === DocketStatus.QC_PENDING) {
        const currentWorkbasketId = docket.routedToTeamId || docket.ownerTeamId || null;
        if (currentWorkbasketId) {
          const qcWorkbasket = await Team.findOne({
            firmId,
            type: 'QC',
            parentWorkbasketId: currentWorkbasketId,
            isActive: true,
          }).session(session).select('_id').lean();
          if (qcWorkbasket?._id) {
            docket.routedToTeamId = qcWorkbasket._id;
          }
        }
      }

      const targetCanonicalState = getCanonicalDocketState({ ...docket.toObject(), status: toPersistenceState(finalTarget) });
      if (targetCanonicalState === 'IN_PROGRESS') {
        throw makeError('Use pull/assign APIs to move docket to IN_PROGRESS');
      }
      if (fromCanonicalState !== targetCanonicalState && !canTransition(fromCanonicalState, targetCanonicalState)) {
        throw makeError(`Invalid docket state transition from ${fromCanonicalState} to ${targetCanonicalState}`, 400, 'INVALID_DOCKET_STATE_TRANSITION');
      }

      const fromLifecycle = normalizeLifecycle(docket.lifecycle || DocketLifecycle.WL);
      const targetLifecycle = toLifecycleFromStatus(finalTarget);
      validateLifecycleAccess({
        actor,
        fromLifecycle,
        toLifecycle: targetLifecycle,
        fromStatus: fromState,
      });

      docket.status = toPersistenceState(finalTarget);
      docket.state = targetCanonicalState;
      if (['IN_PROGRESS', 'IN_WB'].includes(targetCanonicalState)) {
        docket.qcOutcome = null;
      }
      transitionLifecycle(docket, targetLifecycle, {
        firmId,
        actor,
        docketId,
      });
      docket.lastActionByXID = actor.xID;
      docket.lastActionAt = new Date();
      docket.updatedAt = new Date();

      if (finalTarget === DocketStatus.PENDING) {
        docket.reopenAt = reopenAt ? new Date(reopenAt) : null;
        docket.pendingUntil = docket.reopenAt;
      } else {
        docket.reopenAt = null;
        docket.pendingUntil = null;
      }

      if (normalizedTarget === DocketStatus.FILED && duplicateOf) {
        docket.duplicateOf = duplicateOf;
      }

      if (finalTarget === DocketStatus.QC_PENDING) {
        docket.qcStatus = 'REQUESTED';
        docket.qcBy = actor.xID;
        docket.qcAt = new Date();
        docket.qc = {
          ...(docket.qc || {}),
          requestedBy: actor.xID,
          status: 'REQUESTED',
          comment: comment || null,
          requestedAt: new Date(),
          originalAssigneeXID: docket.assignedToXID || actor.xID,
          attempts: Number(docket.qc?.attempts || 0) + 1,
        };
        docket.qcOutcome = null;
        emitDocketEvent(EVENT_NAMES.QC_REQUEST, { docketId, firmId, requestedBy: actor.xID });
      }

      enforceOwnershipRules(docket);
      await docket.save({ session });

      await writeAudit({
        docketId,
        fromState,
        toState: finalTarget,
        userId: actor.xID,
        performedByRole: normalizeActorRole(actor),
        firmId,
        comment,
        action: 'STATE_TRANSITION',
        changes: [{
          field: 'status',
          from: fromState,
          to: finalTarget,
        }, {
          field: 'state',
          from: fromCanonicalState,
          to: targetCanonicalState,
        }],
        metadata: {
          event: 'DOCKET_STATE_CHANGED',
          from: fromCanonicalState,
          to: targetCanonicalState,
          userId: actor.xID,
          timestamp: new Date().toISOString(),
          duplicateOf: duplicateOf || null,
          reopenAt: docket.reopenAt || null,
          ...(finalTarget === DocketStatus.RESOLVED ? {
            actionEvent: 'DOCKET_RESOLVED',
            comment,
          } : {}),
          ...(finalTarget === DocketStatus.FILED ? {
            actionEvent: 'DOCKET_FILED',
            comment,
          } : {}),
        },
        session,
      });

      logActivitySafe({
        docketId: docket.caseInternalId,
        firmId,
        type: 'STATUS_CHANGED',
        description: `State changed from ${fromCanonicalState} to ${targetCanonicalState}`,
        metadata: { from: fromState, to: finalTarget },
        performedByXID: actor?.xID,
      });

      result = docket;
    });

    return result;
  } finally {
    await session.endSession();
  }
}

async function qcDecision({ docketId, firmId, actor, decision, comment }) {
  requireComment(comment, 'QC action');
  const normalizedDecision = String(decision || '').toUpperCase();
  if (!QC_DECISIONS[normalizedDecision]) throw makeError('Invalid QC decision');

  const docket = await Case.findOne({ caseId: docketId, firmId });
  if (!docket) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');

  const fromState = toDocketState(docket.status);
  const fromCanonicalState = getCanonicalDocketState(docket);
  if (fromCanonicalState !== 'IN_QC') {
    throw makeError('QC can only be performed when docket is in QC state');
  }

  const transitionResult = getQcDecisionTransition(fromCanonicalState, normalizedDecision);
  let toState = DocketStatus.RESOLVED;
  if (transitionResult.state === 'IN_PROGRESS') {
    toState = DocketStatus.IN_PROGRESS;
    docket.assignedToXID = docket.qc?.originalAssigneeXID || docket.assignedToXID;
    docket.queueType = 'PERSONAL';
    docket.qcStatus = 'REJECTED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qcOutcome = 'FAILED';
    docket.qc = {
      ...(docket.qc || {}),
      status: 'FAILED',
      handledBy: actor.xID,
      handledAt: new Date(),
      comment,
    };
    emitDocketEvent(EVENT_NAMES.QC_FAILURE, { docketId, firmId, requestedBy: docket.qc?.requestedBy, handledBy: actor.xID });
  }

  if (normalizedDecision === QC_DECISIONS.APPROVED || normalizedDecision === QC_DECISIONS.PASSED) {
    docket.qcOutcome = 'PASSED';
    docket.qcStatus = 'APPROVED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qc = { ...(docket.qc || {}), status: 'APPROVED', handledBy: actor.xID, handledAt: new Date(), comment };
  }

  if (normalizedDecision === QC_DECISIONS.CORRECTED) {
    docket.qcOutcome = 'CORRECTED';
    docket.qcStatus = 'CORRECTED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qc = { ...(docket.qc || {}), status: 'CORRECTED', handledBy: actor.xID, handledAt: new Date(), comment };
  }

  const targetCanonicalState = getCanonicalDocketState({ ...docket.toObject(), status: toPersistenceState(toState) });
  if (fromCanonicalState !== targetCanonicalState && !canTransition(fromCanonicalState, targetCanonicalState)) {
    throw makeError(`Invalid docket state transition from ${fromCanonicalState} to ${targetCanonicalState}`, 400, 'INVALID_DOCKET_STATE_TRANSITION');
  }

  const fromLifecycle = normalizeLifecycle(docket.lifecycle || DocketLifecycle.WL);
  const targetLifecycle = toLifecycleFromStatus(toState);
  validateLifecycleAccess({
    actor,
    fromLifecycle,
    toLifecycle: targetLifecycle,
    fromStatus: fromState,
  });
  docket.status = toPersistenceState(toState);
  docket.state = targetCanonicalState;
  transitionLifecycle(docket, targetLifecycle, {
    firmId,
    actor,
    docketId,
  });
  docket.lastActionByXID = actor.xID;
  docket.lastActionAt = new Date();
  docket.updatedAt = new Date();
  enforceOwnershipRules(docket);
  await docket.save();

  await writeAudit({
    docketId,
    fromState,
    toState: toState,
    userId: actor.xID,
    performedByRole: normalizeActorRole(actor),
    firmId,
    comment,
    action: `QC_${normalizedDecision}`,
    metadata: {
      event: 'QC_ACTION',
      qcOutcome: docket.qcOutcome,
      fromState: fromCanonicalState,
      toState: targetCanonicalState,
      userId: actor.xID,
      comment,
      timestamp: new Date().toISOString(),
    },
    changes: [{
      field: 'status',
      from: fromState,
      to: toState,
    }, {
      field: 'state',
      from: fromCanonicalState,
      to: targetCanonicalState,
    }, {
      field: 'qcOutcome',
      from: null,
      to: docket.qcOutcome,
    }],
  });

  return docket;
}

async function reopenDuePending() {
  const now = new Date();
  const dueCases = await Case.find({ status: toPersistenceState(DocketStatus.PENDING), reopenAt: { $lte: now } });

  if (!dueCases || dueCases.length === 0) {
    return { count: 0, docketIds: [] };
  }

  const caseIdsForUpdate = [];
  const writeAuditPromises = [];
  const docketIds = [];

  for (const docket of dueCases) {
    caseIdsForUpdate.push(docket._id);
    docketIds.push(docket.caseId);

    writeAuditPromises.push(
      writeAudit({
        docketId: docket.caseId,
        fromState: DocketStatus.PENDING,
        toState: DocketStatus.IN_PROGRESS,
        userId: 'SYSTEM',
        comment: 'Auto reopened',
        action: 'PENDING_REOPEN',
        firmId: docket.firmId,
        changes: [{
          field: 'status',
          from: DocketStatus.PENDING,
          to: DocketStatus.IN_PROGRESS,
        }],
      })
    );
  }

  // Execute bulk DB updates and parallel writes simultaneously
  await Promise.all([
    Case.updateMany(
      { _id: { $in: caseIdsForUpdate } },
      {
        $set: {
          status: toPersistenceState(DocketStatus.IN_PROGRESS),
          state: 'IN_PROGRESS',
          qcOutcome: null,
          reopenAt: null,
          pendingUntil: null,
          lastActionAt: now,
          lastActionByXID: 'SYSTEM',
          updatedAt: now,
        },
      }
    ),
    ...writeAuditPromises,
  ]);

  // Safely emit events ONLY after persistence is complete
  for (const docket of dueCases) {
    emitDocketEvent(EVENT_NAMES.PENDING_REOPEN, { docketId: docket.caseId, firmId: docket.firmId });
  }

  return { count: dueCases.length, docketIds };
}

async function reassign({ docketId, firmId, actor, toUserXID, comment }) {
  requireComment(comment, 'Reassignment');
  const docket = await Case.findOne({ caseId: docketId, firmId });
  if (!docket) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');
  assertNotLockedByAnotherActiveUser(docket, actor);
  const nextAssignee = String(toUserXID || '').toUpperCase().trim();
  if (!nextAssignee && normalizeLifecycle(docket.lifecycle) === DocketLifecycle.WL) {
    throw makeError('Cannot move to WL without assignment', 400, 'WL_ASSIGNMENT_REQUIRED');
  }
  const fromAssignee = docket.assignedToXID || null;
  docket.assignedToXID = nextAssignee;
  docket.assignedTo = null;
  docket.assignedAt = new Date();
  docket.lastActionByXID = actor.xID;
  docket.lastActionAt = new Date();
  docket.updatedAt = new Date();
  docket.state = 'IN_PROGRESS';
  docket.queueType = 'PERSONAL';
  docket.qcOutcome = null;
  enforceOwnershipRules(docket);
  await docket.save();
  await writeAudit({
    docketId,
    fromState: toDocketState(docket.status),
    toState: toDocketState(docket.status),
    userId: actor.xID,
    firmId,
    comment,
    action: 'REASSIGNED',
    changes: [{
      field: 'assignedToXID',
      from: fromAssignee,
      to: docket.assignedToXID,
    }],
    metadata: { fromAssignee, toAssignee: docket.assignedToXID },
  });
  await createDocketNotification({
    firmId,
    userId: docket.assignedToXID,
    type: NotificationTypes.REASSIGNED,
    docketId,
    actor,
  });

  logActivitySafe({
    docketId: docket.caseInternalId,
    firmId,
    type: 'ASSIGNED',
    description: `Reassigned from ${fromAssignee || 'unassigned'} to ${docket.assignedToXID || 'unassigned'}`,
    metadata: { fromAssignee, toAssignee: docket.assignedToXID || null },
    performedByXID: actor?.xID,
  });
  return docket;
}

async function activateOnOpen({ docketId, firmId, actor }) {
  const docket = await Case.findOne({ caseId: docketId, firmId });
  if (!docket) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');

  const lifecycle = normalizeLifecycle(docket.lifecycle || DocketLifecycle.CREATED);
  if (lifecycle === DocketLifecycle.WL) {
    transitionLifecycle(docket, DocketLifecycle.ACTIVE, {
      firmId,
      actor,
      docketId,
      suppressLifecycleNotification: true,
    });
    docket.status = toPersistenceState(DocketStatus.IN_PROGRESS);
    docket.state = 'IN_PROGRESS';
    docket.qcOutcome = null;
    docket.lastActionByXID = actor?.xID || docket.assignedToXID || 'SYSTEM';
    docket.lastActionAt = new Date();
    docket.updatedAt = new Date();
    enforceOwnershipRules(docket);
    await docket.save();

    await createDocketNotification({
      firmId,
      userId: docket.assignedToXID,
      type: NotificationTypes.DOCKET_ACTIVATED,
      docketId,
      actor: actor || { xID: docket.assignedToXID || 'SYSTEM', role: 'SYSTEM' },
    });
  }

  return docket;
}

async function handleUserDeactivation({ firmId, userXID }) {
  const normalized = String(userXID || '').toUpperCase();
  const qcp = await Case.updateMany(
    { firmId, assignedToXID: normalized, state: 'IN_QC' },
    { $set: { assignedToXID: null, assignedTo: null, queueType: 'GLOBAL' } },
  );

  const pended = await Case.updateMany(
    { firmId, assignedToXID: normalized, status: toPersistenceState(DocketStatus.PENDING) },
    { $set: { assignedToXID: null, assignedTo: null, queueType: 'GLOBAL' } },
  );

  const rest = await Case.updateMany(
    {
      firmId,
      assignedToXID: normalized,
      state: { $ne: 'IN_QC' },
      status: { $ne: toPersistenceState(DocketStatus.PENDING) },
    },
    { $set: { assignedToXID: null, assignedTo: null, queueType: 'GLOBAL', status: toPersistenceState(DocketStatus.AVAILABLE), state: 'IN_WB', qcOutcome: null } },
  );

  return {
    qcPendingMoved: qcp.modifiedCount || 0,
    pendingMoved: pended.modifiedCount || 0,
    workbasketMoved: rest.modifiedCount || 0,
  };
}

module.exports = {
  DocketStatus,
  QC_DECISIONS,
  getQcDecisionTransition,
  enforceOwnershipRules,
  validateOwnershipRules,
  makeError,
  pullFromWorkbench,
  assignToUser,
  activateOnOpen,
  transition,
  qcDecision,
  reopenDuePending,
  reassign,
  handleUserDeactivation,
};
