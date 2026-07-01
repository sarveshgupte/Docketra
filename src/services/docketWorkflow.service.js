const mongoose = require('mongoose');
const { createHash, randomUUID } = require('crypto');
const Case = require('../models/Case.model');
const { logCaseHistory } = require('./auditLog.service');
const Category = require('../models/Category.model');
const Team = require('../models/Team.model');
const User = require('../models/User.model');
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
const { REASON_CODES } = require('./pilotDiagnostics.service');
const { getCanonicalDocketState } = require('../utils/docketStateMapper');
const { canTransition } = require('../utils/docketStateTransitions');

const getCaseNumberCandidates = (id) => {
  if (!id) return [];
  const normalized = String(id).trim().replace(/[_\s]+/g, '-').toUpperCase();
  const candidates = [String(id)];
  
  const prefixMatch = normalized.match(/^(CASE|DOCKET)-(.+)$/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    const bare = prefixMatch[2];
    const otherPrefix = prefix === 'CASE' ? 'DOCKET' : 'CASE';
    candidates.push(`${prefix}-${bare}`, `${otherPrefix}-${bare}`, bare);
  } else {
    candidates.push(normalized, `CASE-${normalized}`, `DOCKET-${normalized}`);
  }

  return [...new Set(candidates)];
};

const makeDocketQuery = (docketId, firmId) => {
  const candidates = getCaseNumberCandidates(docketId);
  const query = {
    firmId,
    $or: [
      { caseId: { $in: candidates } },
      { caseNumber: { $in: candidates } },
    ],
  };
  if (mongoose.Types.ObjectId.isValid(docketId)) {
    query.$or.push({ caseInternalId: docketId });
    query.$or.push({ _id: docketId });
  }
  return query;
};

const QC_DECISIONS = Object.freeze({
  APPROVED: 'APPROVED',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  CORRECTED: 'CORRECTED',
});

function normalizeQcPercent(value) {
  const percent = Math.round(Number(value) || 0);
  return Math.min(100, Math.max(0, percent));
}

function shouldRouteToQcByPercent({ docketId, percent }) {
  const normalizedPercent = normalizeQcPercent(percent);
  if (normalizedPercent <= 0) return false;
  if (normalizedPercent >= 100) return true;

  const hash = createHash('sha256').update(String(docketId || '')).digest();
  const bucket = hash.readUInt32BE(0) % 100;
  return bucket < normalizedPercent;
}

function findDocketSubcategory(category, docket) {
  const subcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const docketSubcategoryId = String(docket?.subcategoryId || '').trim();
  const docketSubcategoryName = String(docket?.subcategory || docket?.caseSubCategory || '').trim().toLowerCase();

  return subcategories.find((subcategory) => (
    (docketSubcategoryId && String(subcategory?.id || '') === docketSubcategoryId)
    || (docketSubcategoryName && String(subcategory?.name || '').trim().toLowerCase() === docketSubcategoryName)
  )) || null;
}

function resolveQcRoutingDecision({ docket, category, subcategory, sendToQC, resolverUser }) {
  if (sendToQC) {
    return { routeToQc: true, source: 'manual', percent: 100 };
  }

  const forcedByConfiguration = Boolean(docket?.forceQc || subcategory?.forceQC || category?.forceQC);
  if (forcedByConfiguration) {
    return { routeToQc: true, source: 'configured', percent: 100 };
  }

  let effectivePercent;
  let source = 'sampled';
  if (resolverUser && resolverUser.qcSamplingRate !== undefined && resolverUser.qcSamplingRate !== null) {
    effectivePercent = normalizeQcPercent(resolverUser.qcSamplingRate);
    source = 'user_sampled';
  } else {
    const subcategoryPercent = normalizeQcPercent(subcategory?.qcPercent);
    const categoryPercent = normalizeQcPercent(category?.qcPercent);
    effectivePercent = subcategoryPercent > 0 ? subcategoryPercent : categoryPercent;
  }

  const sampled = shouldRouteToQcByPercent({ docketId: docket?.caseId || docket?._id, percent: effectivePercent });

  return {
    routeToQc: sampled,
    source: sampled ? (source === 'user_sampled' ? 'user_sampled' : 'sampled') : 'none',
    percent: effectivePercent,
  };
}

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

  if (docket.state === 'IN_PROGRESS' && !docket.assignedToXID) {
    throw makeError('IN_PROGRESS docket must have owner');
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
  const canonicalReasonCode = metadata?.reasonCode || null;
  const canonicalMetadata = canonicalEvent === 'QC_ACTION'
    ? { ...metadata, comment: comment || null, source: 'qcDecision' }
    : {
      ...metadata,
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
    reasonCode: canonicalReasonCode,
    firmId,
    session,
  });

  let actionType = 'CASE_UPDATED';
  let actionLabel = `Docket updated`;
  let description = `Docket transitioned from ${fromState} to ${toState}`;

  if (action === 'ASSIGNMENT') {
    actionType = 'CASE_ASSIGNED';
    actionLabel = `Docket assigned`;
    description = `Docket pulled from Global Workbasket by ${userId}`;
  } else if (action === 'REASSIGNED') {
    actionType = 'CASE_ASSIGNED';
    actionLabel = `Docket reassigned`;
    const toUser = changes.find(c => c.field === 'assignedToXID')?.to || '';
    description = `Docket reassigned to ${toUser} by ${userId}`;
  } else {
    const lowerTo = String(toState || '').toLowerCase();
    const lowerFrom = String(fromState || '').toLowerCase();
    
    if (lowerTo.includes('pend') && !lowerFrom.includes('pend')) {
      actionType = 'CASE_PENDED';
      actionLabel = `Docket pended`;
      description = `Docket status set to PENDED by ${userId}`;
    } else if (lowerFrom.includes('pend') && !lowerTo.includes('pend')) {
      actionType = 'CASE_UNPENDED';
      actionLabel = `Docket unpended`;
      description = `Docket status set to UNPENDED/REOPENED by ${userId}`;
    } else if (lowerTo.includes('resolve')) {
      actionType = 'CASE_RESOLVED';
      actionLabel = `Docket resolved`;
      description = `Docket status set to RESOLVED by ${userId}`;
    } else if (lowerTo.includes('file')) {
      actionType = 'CASE_FILED';
      actionLabel = `Docket filed`;
      description = `Docket status set to FILED by ${userId}`;
    } else if (lowerTo.includes('qc') || action?.startsWith('QC_')) {
      actionType = 'CASE_STATUS_CHANGED';
      actionLabel = `QC Action: ${action}`;
      description = `QC workflow action taken by ${userId}: ${action}`;
    }
  }

  if (comment) {
    description += ` with comment: "${comment}"`;
  }

  // Load performedBy email asynchronously or fallback to system
  let userEmail = 'system@local';
  try {
    const userRecord = await User.findOne({ xID: String(userId || '').toUpperCase(), firmId }).lean();
    if (userRecord?.email) {
      userEmail = userRecord.email;
    }
  } catch (_e) {
    // best effort user lookup
  }

  await logCaseHistory({
    caseId: docketId,
    firmId,
    actionType,
    actionLabel,
    description,
    performedBy: userEmail.toLowerCase(),
    performedByXID: String(userId || '').toUpperCase(),
    actorRole: performedByRole || 'USER',
    metadata: {
      fromState,
      toState,
      changes,
      action,
      ...metadata,
    },
    session
  });
}

async function pullFromWorkbench({ docketId, firmId, userId, userObjectId = null, assignToXID = null, session = null }) {
  const assigneeXID = String(assignToXID || userId || '').toUpperCase();
  if (!assigneeXID) throw makeError('assignee xID required');

  const candidates = getCaseNumberCandidates(docketId);
  const filter = {
    firmId,
    status: toPersistenceState(DocketStatus.AVAILABLE),
    $or: [{ assignedToXID: null }, { assignedToXID: { $exists: false } }, { assignedToXID: '' }],
    $and: [
      {
        $or: [
          { caseId: { $in: candidates } },
          { caseNumber: { $in: candidates } },
          ...(mongoose.Types.ObjectId.isValid(docketId) ? [{ caseInternalId: docketId }, { _id: docketId }] : [])
        ]
      }
    ]
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
    const query = makeDocketQuery(docketId, firmId);
    const existing = await Case.findOne(query).select('assignedToXID status state');
    if (!existing) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');
    throw makeError('Docket is already assigned', 409, 'DOCKET_ALREADY_ASSIGNED');
  }

  await writeAudit({
    docketId: updated.caseId,
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

  emitDocketEvent(EVENT_NAMES.ASSIGNMENT, { docketId: updated.caseId, firmId, assigneeXID, assignedBy: userId });
  await createDocketNotification({
    firmId,
    userId: assigneeXID,
    type: NotificationTypes.ASSIGNED,
    docketId: updated.caseId,
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
      const query = makeDocketQuery(docketId, firmId);
      const docket = await Case.findOne(query).session(session);
      if (!docket) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');

      const fromState = toDocketState(docket.status);
      const fromCanonicalState = getCanonicalDocketState(docket);
      const normalizedTarget = toDocketState(toState);

      if ([DocketStatus.PENDING, DocketStatus.RESOLVED, DocketStatus.FILED].includes(normalizedTarget)) {
        requireComment(comment, normalizedTarget);
      }

      let finalTarget = normalizedTarget;
      let qcRoutingDecision = { routeToQc: false, source: 'none', percent: 0 };
      if (normalizedTarget === DocketStatus.RESOLVED) {
        const categoryLookup = [];
        if (docket.categoryId && mongoose.Types.ObjectId.isValid(docket.categoryId)) {
          categoryLookup.push({ _id: docket.categoryId });
        }
        if (docket.category) {
          categoryLookup.push({ name: docket.category });
        }
        const category = categoryLookup.length
          ? await Category.findOne({ firmId, $or: categoryLookup }).session(session).lean()
          : null;
        const resolverXID = docket.assignedToXID || actor.xID;
        const resolverUser = resolverXID
          ? await User.findOne({ firmId, xID: resolverXID }).session(session).lean()
          : null;

        qcRoutingDecision = resolveQcRoutingDecision({
          docket,
          category,
          subcategory,
          sendToQC,
          resolverUser,
        });
        if (qcRoutingDecision.routeToQc) {
          finalTarget = DocketStatus.QC_PENDING;
          requireComment(comment, 'QC request');
        }
        docket.forceQc = Boolean(docket.forceQc || sendToQC || category?.forceQC || subcategory?.forceQC);
      }

      let qcWorkbasketId = null;
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
            qcWorkbasketId = qcWorkbasket._id;
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
        docketId: docket.caseId,
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
        const submitterXID = docket.assignedToXID || actor.xID;
        docket.qcStatus = 'REQUESTED';
        docket.qcBy = actor.xID;
        docket.qcAt = new Date();
        docket.qc = {
          ...(docket.qc || {}),
          requestedBy: actor.xID,
          status: 'REQUESTED',
          comment: comment || null,
          requestedAt: new Date(),
          originalAssigneeXID: submitterXID,
          attempts: Number(docket.qc?.attempts || 0) + 1,
          source: qcRoutingDecision.source,
          samplingPercent: qcRoutingDecision.percent,
        };
        if (qcWorkbasketId) {
          docket.ownerTeamId = qcWorkbasketId;
          docket.workbasketId = qcWorkbasketId;
        }
        docket.routedToTeamId = null;
        docket.assignedToXID = null;
        docket.assignedTo = null;
        docket.queueType = 'GLOBAL';
        docket.state = 'IN_QC';
        docket.qcOutcome = null;
        docket.qcSubmittedByXID = submitterXID;
        docket.qcSubmittedAt = new Date();
        docket.qcDecisionByXID = null;
        docket.qcDecisionAt = null;
        docket.qcFailedCorrected = false;
        emitDocketEvent(EVENT_NAMES.QC_REQUEST, { docketId: docket.caseId, firmId, requestedBy: actor.xID });
      }

      enforceOwnershipRules(docket);
      await docket.save({ session });

      await writeAudit({
        docketId: docket.caseId,
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
          qcRouting: normalizedTarget === DocketStatus.RESOLVED ? qcRoutingDecision : undefined,
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

  const query = makeDocketQuery(docketId, firmId);
  const docket = await Case.findOne(query);
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
    docket.assignedToXID = docket.qcSubmittedByXID || docket.qc?.originalAssigneeXID || docket.assignedToXID;
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
    emitDocketEvent(EVENT_NAMES.QC_FAILURE, { docketId: docket.caseId, firmId, requestedBy: docket.qc?.requestedBy, handledBy: actor.xID });
    await createDocketNotification({
      firmId,
      userId: docket.assignedToXID,
      type: NotificationTypes.QC_RETURNED,
      docketId: docket.caseId,
      actor,
      message: `QC returned Docket ${docket.caseId} for correction.`,
    });
  }

  if (normalizedDecision === QC_DECISIONS.APPROVED || normalizedDecision === QC_DECISIONS.PASSED) {
    docket.qcOutcome = 'PASSED';
    docket.qcStatus = 'APPROVED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qc = { ...(docket.qc || {}), status: 'APPROVED', handledBy: actor.xID, handledAt: new Date(), comment };
    docket.qcFailedCorrected = false;
  }

  if (normalizedDecision === QC_DECISIONS.CORRECTED) {
    docket.qcOutcome = 'CORRECTED';
    docket.qcStatus = 'CORRECTED';
    docket.qcBy = actor.xID;
    docket.qcAt = new Date();
    docket.qc = { ...(docket.qc || {}), status: 'CORRECTED', handledBy: actor.xID, handledAt: new Date(), comment };
    docket.qcFailedCorrected = true;
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
  docket.qcDecisionByXID = actor.xID;
  docket.qcDecisionAt = new Date();
  docket.state = targetCanonicalState;
  transitionLifecycle(docket, targetLifecycle, {
    firmId,
    actor,
    docketId: docket.caseId,
  });
  docket.lastActionByXID = actor.xID;
  docket.lastActionAt = new Date();
  docket.updatedAt = new Date();
  enforceOwnershipRules(docket);
  await docket.save();

  await writeAudit({
    docketId: docket.caseId,
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
  const pendingDueFilter = {
    status: toPersistenceState(DocketStatus.PENDING),
    $or: [
      { reopenAt: { $lte: now } },
      { pendingUntil: { $lte: now } },
    ],
  };
  const dueCases = await Case.find(pendingDueFilter);

  if (!dueCases || dueCases.length === 0) {
    return { count: 0, docketIds: [] };
  }

  const updatePromises = [];
  const docketIds = [];

  for (const docket of dueCases) {
    docketIds.push(docket.caseId);
    const hasAssignee = docket.assignedToXID && String(docket.assignedToXID).trim() !== '';
    const isRouted = docket.routedToTeamId && String(docket.routedToTeamId).trim() !== '';

    let toState;
    let stateVal;
    let queueTypeVal;

    if (hasAssignee) {
      toState = 'ASSIGNED';
      stateVal = 'IN_PROGRESS';
      queueTypeVal = 'PERSONAL';
    } else if (isRouted) {
      toState = 'ROUTED';
      stateVal = 'IN_WB';
      queueTypeVal = 'GLOBAL';
    } else {
      toState = 'UNASSIGNED';
      stateVal = 'IN_WB';
      queueTypeVal = 'GLOBAL';
    }

    const updateFields = {
      lifecycle: DocketLifecycle.ACTIVE,
      status: toState,
      state: stateVal,
      queueType: queueTypeVal,
      qcOutcome: null,
      reopenAt: null,
      pendingUntil: null,
      lastActionAt: now,
      lastActionByXID: 'SYSTEM',
      updatedAt: now,
    };

    if (!hasAssignee) {
      updateFields.assignedToXID = null;
      updateFields.assignedTo = null;
    }

    updatePromises.push(
      Case.updateOne({ _id: docket._id }, { $set: updateFields })
    );

    updatePromises.push(
      writeAudit({
        docketId: docket.caseId,
        fromState: DocketStatus.PENDING,
        toState: toDocketState(toState),
        userId: 'SYSTEM',
        comment: 'Auto reopened',
        action: 'PENDING_REOPEN',
        firmId: docket.firmId,
        changes: [{
          field: 'status',
          from: DocketStatus.PENDING,
          to: toDocketState(toState),
        }],
        metadata: {
          reasonCode: REASON_CODES.AUTO_REOPEN_DUE,
          fromState: 'PEND',
          toState: hasAssignee ? 'WL' : 'WB',
        },
      })
    );
  }

  // Execute bulk DB updates and parallel writes simultaneously
  await Promise.all(updatePromises);

  // Safely emit events ONLY after persistence is complete
  for (const docket of dueCases) {
    emitDocketEvent(EVENT_NAMES.PENDING_REOPEN, { docketId: docket.caseId, firmId: docket.firmId });
    if (docket.assignedToXID) {
      await createDocketNotification({
        firmId: docket.firmId,
        userId: docket.assignedToXID,
        type: NotificationTypes.PENDED_DOCKET_REOPENED,
        docketId: docket.caseId,
        actor: { xID: 'SYSTEM', role: 'SYSTEM' },
        message: `Pended Docket ${docket.caseId} is back in your Worklist.`,
      });
    }
  }

  return { count: dueCases.length, docketIds };
}

async function reassign({ docketId, firmId, actor, toUserXID, comment }) {
  requireComment(comment, 'Reassignment');
  const query = makeDocketQuery(docketId, firmId);
  const docket = await Case.findOne(query);
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
    docketId: docket.caseId,
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
    docketId: docket.caseId,
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
  const query = makeDocketQuery(docketId, firmId);
  const docket = await Case.findOne(query);
  if (!docket) throw makeError('Docket not found', 404, 'DOCKET_NOT_FOUND');

  const lifecycle = normalizeLifecycle(docket.lifecycle || DocketLifecycle.CREATED);
  if (lifecycle === DocketLifecycle.WL) {
    transitionLifecycle(docket, DocketLifecycle.ACTIVE, {
      firmId,
      actor,
      docketId: docket.caseId,
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
      docketId: docket.caseId,
      actor: actor || { xID: docket.assignedToXID || 'SYSTEM', role: 'SYSTEM' },
    });
  }

  return docket;
}

async function handleUserDeactivation({ firmId, userXID }) {
  const normalized = String(userXID || '').toUpperCase();
  const assigned = await Case.find({
    firmId,
    assignedToXID: normalized,
    status: { $nin: [toPersistenceState(DocketStatus.RESOLVED), toPersistenceState(DocketStatus.FILED)] },
  }).lean();

  let moved = 0;
  let skipped = 0;
  // ⚡ Bolt Performance Optimization:
  // Instead of fetching categories and teams one by one in a loop (N+1 queries),
  // we first collect all needed category names, fetch them concurrently in a batch,
  // then gather all required workbasket IDs, and fetch the teams in a batch.
  // This reduces the number of database roundtrips from O(N) to O(1).
  const categoryNames = [...new Set(assigned.map(d => d.category).filter(Boolean))];
  const categoriesArr = await Category.find({ firmId, name: { $in: categoryNames }, isActive: true }).lean();
  const categoryMap = new Map(categoriesArr.map(c => [c.name, c]));

  const workbasketIdsToFetch = new Set();
  const docketToMappedId = new Map();

  for (const docket of assigned) {
    const category = categoryMap.get(docket.category);
    if (!category) continue;
    const sub = (category?.subcategories || []).find((entry) => entry?.isActive && (entry.id === docket.subcategoryId || entry.name === docket.subcategory || entry.name === docket.caseSubCategory));
    const mappedId = sub?.workbasketId;
    if (mappedId) {
      workbasketIdsToFetch.add(mappedId);
      docketToMappedId.set(docket._id.toString(), mappedId);
    }
  }

  const teamsArr = await Team.find({ _id: { $in: Array.from(workbasketIdsToFetch) }, firmId, isActive: true, type: 'PRIMARY' }).lean();
  const teamMap = new Map(teamsArr.map(t => [t._id.toString(), t]));

  for (const docket of assigned) {
    const mappedId = docketToMappedId.get(docket._id.toString());
    if (!mappedId) { skipped += 1; continue; }
    const mappedWb = teamMap.get(mappedId.toString());
    if (!mappedWb) { skipped += 1; continue; }

    const result = await Case.updateOne(
      { _id: docket._id },
      {
        $set: {
          assignedToXID: null,
          assignedTo: null,
          assignedBy: null,
          assignedAt: null,
          queueType: 'GLOBAL',
          state: 'IN_WB',
          status: toPersistenceState(DocketStatus.AVAILABLE),
          ownerTeamId: mappedWb._id,
          workbasketId: mappedWb._id,
          qcOutcome: null,
        },
      },
    );
    moved += Number(result.modifiedCount || 0);
  }

  const scanned = assigned.length;
  console.info('[DEACTIVATION_HANDOFF]', { firmId, userXID: normalized, moved, skipped, scanned });
  return { moved, skipped, scanned, workbasketMoved: moved, pendingMoved: 0, qcPendingMoved: 0 };
}

function generateDocketEmailSignature(caseInternalId) {
  if (!caseInternalId) return '';
  const crypto = require('crypto');
  const secret = process.env.SYSTEM_HASH_SECRET || 'docketra-system-default-secret-key-12345';
  return crypto.createHmac('sha256', secret)
    .update(String(caseInternalId))
    .digest('hex')
    .substring(0, 6)
    .toLowerCase();
}

async function reopenDocketFromClientEmail(caseId, firmId, senderEmail) {
  const docket = await Case.findOne({
    firmId: String(firmId),
    $or: [{ caseId: String(caseId) }, { caseNumber: String(caseId) }],
  });

  if (!docket) {
    throw new Error('Docket not found');
  }

  // Check if docket status is PENDING
  if (docket.status !== toPersistenceState(DocketStatus.PENDING)) {
    return { reopened: false, reason: 'Docket is not in PENDING status' };
  }

  const now = new Date();
  const hasAssignee = docket.assignedToXID && String(docket.assignedToXID).trim() !== '';
  const toState = hasAssignee ? DocketStatus.IN_PROGRESS : DocketStatus.AVAILABLE;
  const persistenceState = toPersistenceState(toState);

  const updateFields = {
    lifecycle: DocketLifecycle.ACTIVE,
    status: persistenceState,
    state: hasAssignee ? 'IN_PROGRESS' : 'IN_WB',
    queueType: hasAssignee ? 'PERSONAL' : 'GLOBAL',
    qcOutcome: null,
    reopenAt: null,
    pendingUntil: null,
    lastActionAt: now,
    lastActionByXID: 'SYSTEM',
    updatedAt: now,
  };

  if (!hasAssignee) {
    updateFields.assignedToXID = null;
    updateFields.assignedTo = null;
  }

  await Case.updateOne({ _id: docket._id }, { $set: updateFields });

  await writeAudit({
    docketId: docket.caseId,
    fromState: DocketStatus.PENDING,
    toState: toState,
    userId: 'SYSTEM',
    comment: `Auto reopened on client email from ${senderEmail}`,
    action: 'PENDING_REOPEN',
    firmId: docket.firmId,
    changes: [{
      field: 'status',
      from: DocketStatus.PENDING,
      to: toState,
    }],
    metadata: {
      reasonCode: 'CLIENT_EMAIL_RECEIVED',
      fromState: 'PEND',
      toState: hasAssignee ? 'WL' : 'WB',
    },
  });

  return { reopened: true, fromStatus: DocketStatus.PENDING, toStatus: toState };
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
  resolveQcRoutingDecision,
  generateDocketEmailSignature,
  reopenDocketFromClientEmail,
};
