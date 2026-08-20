const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const User = require('../models/User.model');
const DocketRoute = require('../models/DocketRoute.model');
const Comment = require('../models/Comment.model');
const { logCaseHistory } = require('./auditLog.service');
const commentHistoryNarrativeStorage = require('./commentHistoryNarrativeStorage.service');
const { randomUUID } = require('crypto');
const { getCanonicalDocketState } = require('../utils/docketStateMapper');
const CaseStatus = require('../domain/case/caseStatus');
const { NotificationTypes, createNotification } = require('../domain/notifications');
const log = require('../utils/log');
const CLOUD_NARRATIVE_TIMEOUT_MS = 1800;
const emitNarrativeStorageWarnings = process.env.NARRATIVE_STORAGE_WARNINGS === 'true';
const logNarrativeFallback = (message, context = {}) => {
  if (emitNarrativeStorageWarnings) {
    log.warn(message, context);
    return;
  }
  if (typeof log.debug === 'function') {
    log.debug(message, context);
  }
};

const withTimeout = (promise, timeoutMs, label) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  }),
]);

const makeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const requireComment = (note, context='Action') => {
  if (!String(note||'').trim()) throw makeError(`${context} requires comment`,400);
};

const findDocket = async ({ docketId, firmId }) => {
  const docket = await Case.findOne({ caseId: docketId, firmId });
  if (!docket) throw makeError('Docket not found', 404);
  return docket;
};


async function notifyWorkbasketUsers({ firmId, workbasketId, docketId, workbasketName, actor }) {
  const users = await User.find({
    firmId,
    status: { $ne: 'deleted' },
    isActive: true,
    $or: [{ teamIds: workbasketId }, { teamId: workbasketId }],
  }).select('xID').lean();
  await Promise.all(users.map((user) => createNotification({
    firmId,
    recipientXID: user.xID,
    type: NotificationTypes.DOCKET_ROUTED_TO_WORKBASKET,
    docketId,
    workbasketId: String(workbasketId),
    actor: { ...(actor || {}), workbasketName },
    message: `Docket ${docketId} was routed to ${workbasketName}.`,
  })));
}

const isAdmin = (role) => ['ADMIN', 'PRIMARY_ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(String(role || '').toUpperCase());

async function routeDocket({ docketId, actor, firmId, toTeamId, note }) {
  const docket = await findDocket({ docketId, firmId });
  const actorTeam = String(actor.teamId || '');
  if (!actorTeam) throw makeError('User does not belong to any team', 400);
  requireComment(note, 'Route');

  const canonicalState = getCanonicalDocketState(docket);
  if (['RESOLVED','FILED'].includes(canonicalState)) throw makeError('Terminal dockets cannot be routed', 409);

  if (!isAdmin(actor.role) && String(docket.ownerTeamId || '') !== actorTeam && String(docket.routedToTeamId || '') !== actorTeam) {
    throw makeError('Only owner team, routed team, or admin can route docket', 403);
  }

  const targetTeam = await Team.findOne({ _id: toTeamId, firmId, isActive: true, type: 'PRIMARY' }).select('_id name isActive type').lean();
  if (!targetTeam) throw makeError('Target workbasket must be an active PRIMARY team in this firm', 404);
  if (String(docket.ownerTeamId || '') === String(toTeamId)) throw makeError('Cannot route to owner team', 400);

  const previousOwnerTeamId = docket.ownerTeamId || null;
  const previousWorkbasketId = docket.workbasketId || null;

  docket.routedToTeamId = targetTeam._id;
  docket.ownerTeamId = targetTeam._id;
  docket.workbasketId = targetTeam._id;
  docket.routedByUserId = String(actor.xID || '').toUpperCase();
  docket.routedAt = new Date();
  docket.routingNote = String(note || '').trim();
  docket.status = CaseStatus.ROUTED || 'ROUTED';
  docket.state = 'IN_WB';
  docket.queueType = 'GLOBAL';
  docket.assignedToXID = null;
  docket.assignedTo = null;
  docket.routeOriginatorUserXID = String(actor.xID || '').toUpperCase();
  docket.routeOriginatorTeamId = previousOwnerTeamId;
  docket.routeOriginatorWorkbasketId = previousWorkbasketId;
  await docket.save();

  // Create comment - using commentHistoryNarrativeStorage for cloud-first narrative compliance
  const commentId = String(randomUUID());
  let commentRef = null;
  let storageMode = 'local_fallback';
  try {
    commentRef = await withTimeout(
      commentHistoryNarrativeStorage.uploadComment({
        firmId,
        docketId: docket.caseId,
        commentId,
        payload: { text: note, note: null },
      }),
      CLOUD_NARRATIVE_TIMEOUT_MS,
      'routing comment narrative upload'
    );
    storageMode = 'cloud_first';
  } catch (uploadError) {
    logNarrativeFallback('[ROUTING_COMMENT] Cloud-first comment narrative storage failed to upload; falling back to local MongoDB storage.', {
      message: uploadError.message,
      docketId: docket.caseId,
      firmId,
    });
  }

  const commentPayload = {
    caseId: docket.caseId,
    firmId,
    text: note,
    createdBy: actor.email ? actor.email.toLowerCase() : 'system',
    createdByXID: actor.xID,
    createdByName: actor.name || actor.xID,
    storageMode,
  };

  if (commentRef) {
    commentPayload.commentRef = {
      provider: commentRef.provider,
      mode: commentRef.mode,
      fileId: commentRef.fileId || null,
      objectKey: commentRef.objectKey,
      checksum: commentRef.checksum || null,
      version: 1,
      updatedAt: new Date(),
      updatedBy: actor.xID,
    };
  }

  await Comment.create(commentPayload);

  // Log to CaseHistory & CaseAudit via centralized logging helper
  await logCaseHistory({
    caseId: docket.caseId,
    firmId,
    actionType: 'CASE_MOVED_TO_WORKBASKET',
    actionLabel: 'Docket routed',
    description: `Docket routed from ${previousOwnerTeamId || 'unassigned'} to ${targetTeam._id} with comment: ${note}`,
    performedBy: actor.email,
    performedByXID: actor.xID,
    actorRole: actor.role,
    metadata: {
      fromTeamId: previousOwnerTeamId,
      toTeamId: targetTeam._id,
      note,
    },
  });

  await DocketRoute.create({
    docketId,
    fromTeamId: previousOwnerTeamId,
    toTeamId: targetTeam._id,
    routedBy: String(actor.xID || '').toUpperCase(),
    routedAt: docket.routedAt,
    note: note || null,
    firmId,
  });

  await notifyWorkbasketUsers({
    firmId,
    workbasketId: targetTeam._id,
    docketId,
    workbasketName: targetTeam.name,
    actor,
  });

  return docket;
}

async function acceptRoutedDocket({ docketId, actor, firmId }) {
  const docket = await findDocket({ docketId, firmId });
  if (!docket.routedToTeamId || String(docket.routedToTeamId) !== String(actor.teamId || '')) {
    throw makeError('Only routed team can accept', 403);
  }
  docket.status = CaseStatus.IN_PROGRESS;
  await docket.save();
  return docket;
}

async function returnRoutedDocket({ docketId, actor, firmId, note }) {
  const docket = await findDocket({ docketId, firmId });
  requireComment(note, 'Submit');
  if (!docket.routedToTeamId || String(docket.routedToTeamId) !== String(actor.teamId || '')) {
    throw makeError('Only routed team can submit routed docket', 403);
  }
  if (String(docket.assignedToXID || '').toUpperCase() !== String(actor.xID || '').toUpperCase()) {
    throw makeError('Only assigned routed user can submit', 403);
  }
  const originatorXID = String(docket.routeOriginatorUserXID || docket.routedByUserId || '').toUpperCase();
  if (!originatorXID) throw makeError('Routed docket is missing originator', 409);

  const activeRoute = await DocketRoute.findOne({ docketId, firmId, returnedAt: null }).sort({ routedAt: -1 });
  if (activeRoute) {
    activeRoute.returnedAt = new Date();
    if (note) activeRoute.note = `${activeRoute.note || ''}\nReturn note: ${note}`.trim();
    await activeRoute.save();
  }

  docket.routedToTeamId = null;
  docket.ownerTeamId = docket.routeOriginatorTeamId || docket.ownerTeamId;
  docket.workbasketId = docket.routeOriginatorWorkbasketId || docket.workbasketId;
  docket.assignedToXID = originatorXID;
  docket.queueType = 'PERSONAL';
  docket.state = 'IN_PROGRESS';
  docket.status = CaseStatus.IN_PROGRESS;
  docket.routingNote = String(note || '').trim();
  docket.routeReturnedAt = new Date();
  docket.routeOriginatorUserXID = null;
  docket.routeOriginatorTeamId = null;
  docket.routeOriginatorWorkbasketId = null;
  await docket.save();
  return docket;
}

async function transitionRoutedTeamStatus({ docketId, actor, firmId, status }) {
  const docket = await findDocket({ docketId, firmId });
  const allowed = new Set([CaseStatus.IN_PROGRESS, CaseStatus.PENDING]);
  if (!allowed.has(status)) throw makeError('Invalid status for routed team', 400);
  if (!docket.routedToTeamId || String(docket.routedToTeamId) !== String(actor.teamId || '')) {
    throw makeError('Only routed team can update routed status', 403);
  }
  docket.status = status;
  await docket.save();
  return docket;
}

async function resolveDocketWithTeamRestriction({ docketId, actor, firmId }) {
  const docket = await findDocket({ docketId, firmId });
  if (String(docket.ownerTeamId || '') !== String(actor.teamId || '')) {
    throw makeError('Only owner team can resolve', 403);
  }
  if (docket.routedToTeamId) {
    throw makeError('Cannot resolve while docket is routed', 409);
  }
  docket.status = CaseStatus.RESOLVED;
  await docket.save();
  return docket;
}



async function managerMoveDocket({ docketId, actor, firmId, to }) {
  const docket = await findDocket({ docketId, firmId });
  if (String(actor.role || '').toUpperCase() !== 'MANAGER') {
    throw makeError('Manager role required', 403);
  }
  if (String(docket.ownerTeamId || '') !== String(actor.teamId || '')) {
    throw makeError('Cross-team movement is forbidden', 403);
  }

  const targetType = String(to?.type || '').toUpperCase();
  if (!['WL', 'WB'].includes(targetType)) {
    throw makeError('Invalid target type. Use WL or WB', 400);
  }

  if (targetType === 'WL') {
    const targetUserXid = String(to.userXID || '').toUpperCase();
    const targetUser = await User.findOne({ xID: targetUserXid, firmId, teamId: actor.teamId, status: { $ne: 'deleted' } });
    if (!targetUser) throw makeError('Target user must be in manager team', 400);
    const prevAssignee = docket.assignedToXID;
    docket.assignedToXID = targetUserXid;
    docket.status = CaseStatus.IN_PROGRESS;
    await createNotification({ firmId, recipientXID: targetUserXid, type: NotificationTypes.DOCKET_ASSIGNED, docketId, message: `Docket ${docketId} has been assigned to you.` });

    await logCaseHistory({
      caseId: docketId,
      firmId,
      actionType: 'CASE_ASSIGNED',
      actionLabel: `Docket reassigned by manager`,
      description: `Docket reassigned from ${prevAssignee || 'unassigned'} to ${targetUserXid} by manager ${actor.xID}`,
      performedBy: actor.email,
      performedByXID: actor.xID,
      actorRole: actor.role,
      metadata: {
        previousAssignee: prevAssignee,
        newAssignee: targetUserXid,
      }
    });
  } else {
    const prevAssignee = docket.assignedToXID;
    docket.assignedToXID = null;
    docket.status = CaseStatus.UNASSIGNED || 'UNASSIGNED';

    await logCaseHistory({
      caseId: docketId,
      firmId,
      actionType: 'CASE_UNASSIGNED',
      actionLabel: `Docket unassigned by manager`,
      description: `Docket moved back to workbasket from ${prevAssignee || 'unassigned'} by manager ${actor.xID}`,
      performedBy: actor.email,
      performedByXID: actor.xID,
      actorRole: actor.role,
      metadata: {
        previousAssignee: prevAssignee,
      }
    });
  }

  docket.routedToTeamId = actor.teamId;
  await docket.save();
  return docket;
}

module.exports = {
  routeDocket,
  acceptRoutedDocket,
  returnRoutedDocket,
  transitionRoutedTeamStatus,
  resolveDocketWithTeamRestriction,
  managerMoveDocket,
};
