const Case = require('../models/Case.model');
const DocketAuditLog = require('../models/DocketAuditLog.model');
const { randomUUID } = require('crypto');
const {
  toDocketState,
  toPersistenceState,
} = require('../domain/docket/docketStateMachine');
const { isValidTransition, toLifecycleFromStatus } = require('../domain/docketLifecycle');

const normalizeActorRole = (role) => {
  const value = String(role || '').toUpperCase().replace('SUPERADMIN', 'SUPER_ADMIN');
  if (value === 'ADMIN' || value === 'SUPER_ADMIN' || value === 'MANAGER' || value === 'SYSTEM') return value;
  return 'USER';
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

  const docket = await Case.findOne({ caseId: docketId, firmId }).lean();
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
  const currentState = docket.lifecycle;
  const nextState = toLifecycleFromStatus(newState);

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
    caseId: docketId,
    firmId,
    version: expected,
  };

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

  if (options.skipAudit) {
    return {
      docketId,
      fromState,
      toState,
      version: expected + 1,
    };
  }

  await DocketAuditLog.create([{
    docketId,
    action,
    fromState,
    toState,
    requestId: String(options?.req?.context?.requestId || options?.req?.requestId || options?.metadata?.requestId || randomUUID()),
    tenantId: firmId,
    performedBy: {
      userId: String(userId || 'SYSTEM'),
      role: normalizeActorRole(options?.req?.user?.role || options?.actorRole),
    },
    firmId,
    timestamp: new Date(),
    metadata: {
      ...metadata,
      reason: reason || null,
      notes: notes || null,
      versionFrom: expected,
      versionTo: expected + 1,
    },
  }], session ? { session } : {});

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
