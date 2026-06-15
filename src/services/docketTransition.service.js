const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const docketAuditService = require('./docketAudit.service');
const {
  toDocketState,
  toPersistenceState,
} = require('../domain/docket/docketStateMachine');
const { isValidTransition, toLifecycleFromStatus, normalizeLifecycle } = require('../domain/docketLifecycle');

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

async function transitionDocket(docketId, newState, userId, options = {}) {
  const {
    firmId,
    reason,
    notes,
    metadata = {},
    action = 'MOVED',
    session = null,
    expectedVersion,
  } = options;

  if (!firmId) {
    const err = new Error('Firm context is required');
    err.statusCode = 400;
    throw err;
  }

  if (!docketId || !newState || !userId) {
    const err = new Error('docketId, newState, and userId are required');
    err.statusCode = 400;
    throw err;
  }

  const query = makeDocketQuery(docketId, firmId);
  const docket = await Case.findOne(query).lean();
  if (!docket) {
    const err = new Error('Docket not found');
    err.statusCode = 404;
    throw err;
  }

  if (String(docket.firmId) !== String(firmId)) {
    const err = new Error('Docket does not belong to current firm scope');
    err.statusCode = 403;
    throw err;
  }

  const fromState = toDocketState(docket.status);
  const toState = toDocketState(newState);
  const currentState = normalizeLifecycle(docket.lifecycle);
  const nextState = normalizeLifecycle(toLifecycleFromStatus(newState));

  if (toState === 'PENDING' && !reason) {
    const err = new Error('PENDING transition requires reason');
    err.statusCode = 400;
    throw err;
  }

  if (toState === 'RESOLVED' && !notes) {
    const err = new Error('RESOLVED transition requires notes');
    err.statusCode = 400;
    throw err;
  }

  if (!isValidTransition(currentState, nextState)) {
    throw new Error(`Invalid transition from ${currentState} to ${nextState}`);
  }

  const persistenceState = toPersistenceState(toState);
  const currentVersion = Number.isInteger(docket.version) ? docket.version : 0;
  const expected = Number.isInteger(expectedVersion) ? expectedVersion : currentVersion;

  const updateFilter = {
    _id: docket._id,
  };
  updateFilter.$or = [{ version: expected }];
  if (expected === 0) {
    updateFilter.$or.push({ version: { $exists: false } });
  }

  const update = {
    $set: {
      status: persistenceState,
      ...(toState !== 'PENDING' ? { pendingUntil: null } : {}),
      updatedAt: new Date(),
    },
    $inc: {
      version: 1,
    },
  };

  const result = await Case.updateOne(updateFilter, update, session ? { session } : {});
  const matchedCount = result?.matchedCount ?? result?.n ?? 0;
  if (matchedCount === 0) {
    const err = new Error('Version mismatch: docket was updated by another request');
    err.statusCode = 409;
    err.code = 'DOCKET_VERSION_CONFLICT';
    throw err;
  }

  if (!options.skipAudit) {
    await docketAuditService.logStatusChange({
      firmId,
      docketId,
      performedBy: userId,
      performedByRole: metadata?.actorRole || 'USER',
      fromStatus: fromState,
      toStatus: toState,
      metadata: {
        ...metadata,
        requestId: String(options?.req?.context?.requestId || options?.req?.requestId || metadata?.requestId || randomUUID()),
        reason: reason || null,
        notes: notes || null,
        versionFrom: expected,
        versionTo: expected + 1,
        transitionAction: action,
        source: 'docketTransition.service.transitionDocket',
      },
      comment: notes || reason || null,
      session,
    });
  }

  return {
    docketId,
    fromState,
    toState,
    version: expected + 1,
  };
}

module.exports = {
  transitionDocket,
};
