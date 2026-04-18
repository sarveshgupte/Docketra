const DocketSession = require('../models/DocketSession.model');
const { logCaseHistory } = require('./auditLog.service');
const { logDocketEvent } = require('./docketAudit.service');

const HEARTBEAT_COUNT_THRESHOLD_SECONDS = 30;
const HEARTBEAT_STALE_THRESHOLD_SECONDS = 60;

const toSafeDeltaSeconds = (from, to) => {
  const delta = Math.floor((to.getTime() - from.getTime()) / 1000);
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return delta;
};

async function startSession({ docketId, firmId, userId, req, userRole, userEmail, now = new Date() }) {
  await DocketSession.updateMany(
    { docketId, firmId, userId, isActive: true },
    { isActive: false, endedAt: now }
  );

  const session = await DocketSession.create({
    docketId,
    firmId,
    userId,
    startedAt: now,
    lastHeartbeatAt: now,
    activeSeconds: 0,
    isActive: true,
  });

  await logCaseHistory({
    caseId: docketId,
    firmId,
    actionType: 'DOCKET_SESSION_STARTED',
    actionLabel: 'Docket session started',
    description: `${userId} started an active docket session`,
    performedByXID: userId,
    performedBy: userEmail || 'system@docketra.local',
    actorRole: userRole,
    metadata: {
      event: 'DOCKET_SESSION_STARTED',
      sessionId: String(session._id),
      activeSeconds: session.activeSeconds,
      startedAt: session.startedAt,
    },
    req,
  });

  await logDocketEvent({
    docketId,
    firmId,
    event: 'SESSION_STARTED',
    userId,
    userRole,
    metadata: {
      sessionId: String(session._id),
      activeSeconds: session.activeSeconds,
    },
  });

  return session;
}

async function heartbeat({ docketId, firmId, userId, now = new Date() }) {
  const session = await DocketSession.findOne({
    docketId,
    firmId,
    userId,
    isActive: true,
  });

  if (!session) return null;

  const delta = toSafeDeltaSeconds(new Date(session.lastHeartbeatAt), now);

  if (delta > 0 && delta <= HEARTBEAT_COUNT_THRESHOLD_SECONDS) {
    session.activeSeconds += delta;
  }

  // stale sessions (delta > 60) are treated as idle by not incrementing activeSeconds.
  if (delta > HEARTBEAT_STALE_THRESHOLD_SECONDS) {
    session.lastHeartbeatAt = now;
    await session.save();
    return session;
  }

  session.lastHeartbeatAt = now;
  await session.save();

  return session;
}

async function endSession({ docketId, firmId, userId, req, userRole, userEmail, now = new Date() }) {
  const session = await DocketSession.findOne({
    docketId,
    firmId,
    userId,
    isActive: true,
  });

  if (!session) return null;

  session.isActive = false;
  session.endedAt = now;
  await session.save();

  await logCaseHistory({
    caseId: docketId,
    firmId,
    actionType: 'DOCKET_SESSION_ENDED',
    actionLabel: 'Docket session ended',
    description: `${userId} ended an active docket session`,
    performedByXID: userId,
    performedBy: userEmail || 'system@docketra.local',
    actorRole: userRole,
    metadata: {
      event: 'DOCKET_SESSION_ENDED',
      sessionId: String(session._id),
      activeSeconds: session.activeSeconds,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
    req,
  });

  await logDocketEvent({
    docketId,
    firmId,
    event: 'SESSION_ENDED',
    userId,
    userRole,
    metadata: { activeSeconds: session.activeSeconds, sessionId: String(session._id) },
  });

  return session;
}

module.exports = {
  HEARTBEAT_COUNT_THRESHOLD_SECONDS,
  HEARTBEAT_STALE_THRESHOLD_SECONDS,
  startSession,
  heartbeat,
  endSession,
};
