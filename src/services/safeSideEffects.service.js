const log = require('../utils/log');
const { enqueueAfterCommit } = require('./sideEffectQueue.service');
const { logAuthEvent } = require('./audit.service');

const resolveContext = (context, fallback = null) => context || fallback || null;

const runSideEffect = async ({ context = null, type, payload = {}, execute }) => {
  if (typeof execute !== 'function') {
    return false;
  }

  const target = resolveContext(context);
  const requestId = target?.requestId || payload.requestId || null;
  const firmId = target?.context?.firmId || target?.user?.firmId || payload.tenantId || payload.firmId || null;
  const route = target?.context?.route || target?.originalUrl || target?.url || payload.route || null;
  const userXID = target?.context?.userXID || target?.user?.xID || payload.userXID || null;

  const runner = async () => {
    try {
      await execute();
    } catch (error) {
      log.error(`${type}_FAILURE`, {
        req: target,
        requestId,
        firmId,
        tenantId: firmId,
        route,
        userXID,
        ...payload,
        error: error.message,
      });
    }
  };

  if (target?._pendingSideEffects) {
    enqueueAfterCommit(target, {
      type,
      payload: {
        requestId,
        firmId,
        route,
        userXID,
        ...payload,
      },
      execute: runner,
    });
    return true;
  }

  await runner();
  return true;
};

const safeAuditLog = async (auditData = {}, context = null) => {
  const resolvedContext = resolveContext(context, auditData.req);
  return runSideEffect({
    context: resolvedContext,
    type: 'FORENSIC_AUDIT',
    payload: {
      action: auditData.actionType || auditData.eventType || null,
      entityId: auditData.userId || auditData.xID || auditData.performedBy || null,
      tenantId: auditData.firmId || null,
    },
    execute: async () => {
      await logAuthEvent({
        ...auditData,
        req: auditData.req || resolvedContext || null,
      });
    },
  });
};

const safeQueueEmail = async ({ context = null, operation = 'EMAIL_QUEUE', payload = {}, execute }) => runSideEffect({
  context,
  type: operation,
  payload,
  execute,
});

const safeAnalyticsEvent = async ({ context = null, eventName = 'ANALYTICS_EVENT', payload = {}, execute = null }) => runSideEffect({
  context,
  type: eventName,
  payload,
  execute: execute || (async () => {}),
});

module.exports = {
  safeAuditLog,
  safeQueueEmail,
  safeAnalyticsEvent,
};
