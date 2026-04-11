const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Category = require('../models/Category.model');
const DocketAuditLog = require('../models/DocketAuditLog.model');
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

const QC_DECISIONS = Object.freeze({ APPROVED: 'APPROVED', FAILED: 'FAILED', CORRECTED: 'CORRECTED' });

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

  if (role === 'USER' && String(toDocketState(fromStatus) || '').toUpperCase() === DocketStatus.QC_PENDING) {
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

async function writeAudit({ docketId, fromState, toState, userId, comment = null, performedByRole = 'USER', firmId, action, metadata = {}, session = null }) {
  await DocketAuditLog.create([{
    docketId,
    action,
    fromState,
    toState,
    comment,
    performedByRole,
    performedBy: userId,
    timestamp: new Date(),
    metadata: { ...metadata, comment },
    firmId,
  }], session ? { session } : {});
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
      ...(userObjectId ? { assignedTo: userObjectId } : {}),
      assignedAt: new Date(),
      lastActionByXID: String(userId || '').toUpperCase(),
      lastActionAt: new Date(),
      updatedAt: new Date(),
      queueType: 'PERSONAL',
    },
    $inc: { version: 1 },
  };

  const updated = await Case.findOneAndUpdate(filter, update, {
    new: true,
    session,
  });

  if (!updated) {
    const existing = await Case.findOne({ caseId: docketId, firmId }).select('assignedToXID status').lean();
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
  return updated;
}

async function transition({ docketId, firmId, actor, toState, comment, reopenAt, sendToQC = false, duplicateOf = null }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const docket = await Case.findOne({ caseId: docketId, firmId }).session(session);
      if (!docket) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');

      const fromState = toDocketState(docket.status);
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

      const fromLifecycle = normalizeLifecycle(docket.lifecycle || DocketLifecycle.WL);
      const targetLifecycle = toLifecycleFromStatus(finalTarget);
      validateLifecycleAccess({
        actor,
        fromLifecycle,
        toLifecycle: targetLifecycle,
        fromStatus: fromState,
      });

      docket.status = toPersistenceState(finalTarget);
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
        docket.assignedToXID = null;
        docket.assignedTo = null;
        docket.queueType = 'GLOBAL';
        emitDocketEvent(EVENT_NAMES.QC_REQUEST, { docketId, firmId, requestedBy: actor.xID });
      }

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
        metadata: { duplicateOf: duplicateOf || null, reopenAt: docket.reopenAt || null },
        session,
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
  if (fromState !== DocketStatus.QC_PENDING) throw makeError('Only QC_PENDING dockets can be QC handled');

  let toState = DocketStatus.RESOLVED;
  if (normalizedDecision === QC_DECISIONS.FAILED) {
    toState = DocketStatus.ASSIGNED;
    docket.assignedToXID = docket.qc?.originalAssigneeXID || docket.assignedToXID;
    docket.queueType = 'PERSONAL';
    docket.qcStatus = 'REJECTED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qc = {
      ...(docket.qc || {}),
      status: 'FAILED',
      handledBy: actor.xID,
      handledAt: new Date(),
      comment,
    };
    emitDocketEvent(EVENT_NAMES.QC_FAILURE, { docketId, firmId, requestedBy: docket.qc?.requestedBy, handledBy: actor.xID });
  }

  if (normalizedDecision === QC_DECISIONS.APPROVED) {
    docket.qcStatus = 'APPROVED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qc = { ...(docket.qc || {}), status: 'APPROVED', handledBy: actor.xID, handledAt: new Date(), comment };
  }

  if (normalizedDecision === QC_DECISIONS.CORRECTED) {
    docket.qcStatus = 'CORRECTED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qc = { ...(docket.qc || {}), status: 'CORRECTED', handledBy: actor.xID, handledAt: new Date(), comment };
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
  transitionLifecycle(docket, targetLifecycle, {
    firmId,
    actor,
    docketId,
  });
  docket.lastActionByXID = actor.xID;
  docket.lastActionAt = new Date();
  docket.updatedAt = new Date();
  await docket.save();

  await writeAudit({
    docketId,
    fromState,
    toState: targetLifecycle,
    userId: actor.xID,
    performedByRole: normalizeActorRole(actor),
    firmId,
    comment,
    action: `QC_${normalizedDecision}`,
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
  docket.assignedAt = new Date();
  docket.lastActionByXID = actor.xID;
  docket.lastActionAt = new Date();
  docket.updatedAt = new Date();
  docket.queueType = docket.assignedToXID ? 'PERSONAL' : 'GLOBAL';
  await docket.save();
  await writeAudit({ docketId, fromState: toDocketState(docket.status), toState: toDocketState(docket.status), userId: actor.xID, firmId, comment, action: 'REASSIGNED', metadata: { fromAssignee, toAssignee: docket.assignedToXID } });
  await createDocketNotification({
    firmId,
    userId: docket.assignedToXID,
    type: NotificationTypes.REASSIGNED,
    docketId,
    actor,
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
    docket.lastActionByXID = actor?.xID || docket.assignedToXID || 'SYSTEM';
    docket.lastActionAt = new Date();
    docket.updatedAt = new Date();
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
    { firmId, assignedToXID: normalized, status: toPersistenceState(DocketStatus.QC_PENDING) },
    { $set: { assignedToXID: null, assignedTo: null, queueType: 'GLOBAL' } },
  );

  const rest = await Case.updateMany(
    { firmId, assignedToXID: normalized, status: { $ne: toPersistenceState(DocketStatus.QC_PENDING) } },
    { $set: { assignedToXID: null, assignedTo: null, queueType: 'GLOBAL', status: toPersistenceState(DocketStatus.AVAILABLE) } },
  );

  return { qcPendingMoved: qcp.modifiedCount || 0, workbasketMoved: rest.modifiedCount || 0 };
}

module.exports = {
  DocketStatus,
  QC_DECISIONS,
  pullFromWorkbench,
  assignToUser,
  activateOnOpen,
  transition,
  qcDecision,
  reopenDuePending,
  reassign,
  handleUserDeactivation,
};
