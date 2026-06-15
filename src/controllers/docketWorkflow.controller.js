const {
  DocketStatus,
  pullFromWorkbench,
  transition,
  qcDecision,
  reassign,
  reopenDuePending,
} = require('../services/docketWorkflow.service');
const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const User = require('../models/User.model');
const { logCaseHistory } = require('../services/auditLog.service');
const { canAssignFromWorkbasket, canMoveBetweenWorklists, canMoveDocketBetweenQueues, getFirmUserByXid } = require('../services/workbasketAuthorization.service');
const { isValidTransition: isValidLifecycleTransition } = require('../domain/docketLifecycle');

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

function isAdmin(req) {
  return ['ADMIN','PRIMARY_ADMIN'].includes(String(req.user?.role || '').toUpperCase());
}

function isValidTransition(fromState, toState) {
  return isValidLifecycleTransition(fromState, toState);
}

function handleError(res, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
  return res.status(status).json({ success: false, message: error.message || 'Unable to process docket action', code: error.code || 'DOCKET_ACTION_FAILED' });
}

function ensureUpdatedAt(docket) {
  if (docket && !docket.updatedAt) {
    docket.updatedAt = new Date();
  }
  return docket;
}

async function assignDocket(req, res) {
  try {
    const { caseId } = req.params;
    const assigneeXID = req.body?.assigneeXID || req.user?.xID;

    const query = makeDocketQuery(caseId, req.user.firmId);
    const docket = await Case.findOne(query).select('caseId ownerTeamId workbasketId status state assignedToXID').lean();
    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });
    const assignee = await getFirmUserByXid(req.user.firmId, assigneeXID);
    if (!assignee) return res.status(404).json({ success: false, message: 'Assignee not found' });
    const isAlreadyAssigned = Boolean(String(docket?.assignedToXID || '').trim());
    const allowed = isAlreadyAssigned
      ? canMoveBetweenWorklists({ actor: req.user, docket, toUser: assignee })
      : canAssignFromWorkbasket({ actor: req.user, docket, assignee });
    if (!allowed) {
      return res.status(403).json({ success: false, message: isAlreadyAssigned ? 'Not allowed to move this docket' : 'Not allowed to assign this docket' });
    }

    const updated = await pullFromWorkbench({
      docketId: caseId,
      firmId: req.user.firmId,
      userId: req.user.xID,
      userObjectId: req.user._id,
      assignToXID: assigneeXID,
    });

    return res.json({ success: true, data: ensureUpdatedAt(updated), message: 'Docket assigned' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function transitionDocket(req, res) {
  try {
    const { caseId } = req.params;
    const { toState, status, comment, reopenAt, sendToQC, duplicateOf } = req.body || {};

    const updated = await transition({
      docketId: caseId,
      firmId: req.user.firmId,
      actor: req.user,
      toState: toState || status,
      comment,
      reopenAt,
      sendToQC,
      duplicateOf,
    });

    return res.json({ success: true, data: ensureUpdatedAt(updated), message: 'Docket transitioned' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function reopenPendingDocket(req, res) {
  try {
    const { caseId } = req.params;
    const updated = await transition({
      docketId: caseId,
      firmId: req.user.firmId,
      actor: req.user,
      toState: DocketStatus.IN_PROGRESS,
      comment: req.body?.comment || 'Manually reopened',
    });
    return res.json({ success: true, data: ensureUpdatedAt(updated), message: 'Docket reopened' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function qcAction(req, res) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Only admins can perform QC actions' });
    const { caseId } = req.params;
    const { decision, comment } = req.body || {};
    const updated = await qcDecision({ docketId: caseId, firmId: req.user.firmId, actor: req.user, decision, comment });
    return res.json({ success: true, data: ensureUpdatedAt(updated), message: 'QC action applied' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function reassignDocket(req, res) {
  try {

    const { caseId } = req.params;
    const { assigneeXID, comment } = req.body || {};
    const query = makeDocketQuery(caseId, req.user.firmId);
    const docket = await Case.findOne(query).select('caseId ownerTeamId workbasketId status state assignedToXID').lean();
    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });
    const assignee = await getFirmUserByXid(req.user.firmId, assigneeXID);
    if (!assignee) return res.status(404).json({ success: false, message: 'Assignee not found' });
    if (!canMoveBetweenWorklists({ actor: req.user, docket, toUser: assignee })) {
      return res.status(403).json({ success: false, message: 'Not allowed to move this docket' });
    }
    const updated = await reassign({ docketId: caseId, firmId: req.user.firmId, actor: req.user, toUserXID: assigneeXID, comment });
    return res.json({ success: true, data: ensureUpdatedAt(updated), message: 'Docket reassigned' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function runPendingReopen(req, res) {
  try {
    const result = await reopenDuePending();
    return res.json({ success: true, data: result, message: `Reopened ${result.count} docket(s)` });
  } catch (error) {
    return handleError(res, error);
  }
}

async function moveDocket(req, res) {
  try {
    const { caseId } = req.params;
    const { destinationType, assigneeXID, destinationId, note } = req.body || {};
    const query = makeDocketQuery(caseId, req.user.firmId);
    const docket = await Case.findOne(query).select('caseId firmId ownerTeamId workbasketId assignedToXID status state').lean();
    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });

    let updates = {};
    let destinationMeta = { destinationType };
    let destinationPolicyContext = { type: destinationType };
    if (destinationType === 'USER_WORKLIST') {
      const assignee = await getFirmUserByXid(req.user.firmId, assigneeXID);
      if (!assignee) return res.status(404).json({ success: false, message: 'Destination assignee not found' });
      updates = {
        assignedToXID: assignee.xID,
        assignedTo: assignee._id,
        assignedToName: assignee.name || assignee.xID,
        queueType: 'PERSONAL',
        status: 'ASSIGNED',
        state: 'IN_PROGRESS',
        lifecycle: 'WL',
      };
      destinationMeta = { ...destinationMeta, assigneeXID: assignee.xID };
      destinationPolicyContext = { ...destinationPolicyContext, assigneeXID: assignee.xID, user: assignee };
    } else {
      const destinationTeam = await Team.findOne({ _id: destinationId, firmId: req.user.firmId, isActive: true }).select('_id type parentWorkbasketId').lean();
      if (!destinationTeam) return res.status(404).json({ success: false, message: 'Destination queue not found for this firm' });
      if (destinationType === 'WORKBASKET' && String(destinationTeam.type || 'PRIMARY').toUpperCase() === 'QC') {
        return res.status(400).json({ success: false, message: 'Destination must be a primary workbasket' });
      }
      if (destinationType === 'QC_WORKBASKET' && String(destinationTeam.type || '').toUpperCase() !== 'QC') {
        return res.status(400).json({ success: false, message: 'Destination must be a QC workbasket' });
      }
      updates = {
        ownerTeamId: destinationTeam._id,
        workbasketId: destinationTeam._id,
        routedToTeamId: null,
        assignedToXID: null,
        assignedTo: null,
        assignedToName: null,
        queueType: 'GLOBAL',
      };
      destinationMeta = { ...destinationMeta, destinationId: String(destinationTeam._id) };
      destinationPolicyContext = { ...destinationPolicyContext, teamId: String(destinationTeam._id), team: destinationTeam };
    }

    const managerOwnedTeams = await Team.find({ firmId: req.user.firmId, managerId: req.user._id, isActive: true }).select('_id').lean();
    const managedUsers = await User.find({ firmId: req.user.firmId, managerId: req.user._id, isActive: true }).select('xID').lean();
    const managerScope = {
      permittedTeamIds: [...new Set([
        ...(Array.isArray(req.user?.teamIds) ? req.user.teamIds : []).map((id) => String(id)),
        ...managerOwnedTeams.map((team) => String(team._id)),
      ])],
      permittedUserXids: [...new Set([
        String(req.user?.xID || '').toUpperCase(),
        ...managedUsers.map((user) => String(user.xID || '').toUpperCase()),
      ])],
    };

    if (!canMoveDocketBetweenQueues({
      viewer: req.user,
      docket,
      source: { teamId: docket.ownerTeamId ? String(docket.ownerTeamId) : (docket.workbasketId ? String(docket.workbasketId) : null), assignedToXID: docket.assignedToXID || null },
      destination: destinationPolicyContext,
      managerScope,
    })) {
      return res.status(403).json({ success: false, message: 'Not allowed to move this docket' });
    }

    const updated = await Case.findOneAndUpdate(
      makeDocketQuery(caseId, req.user.firmId),
      { $set: updates },
      { new: true },
    );

    await logCaseHistory({
      caseId,
      firmId: req.user.firmId,
      actionType: 'CASE_UPDATED',
      actionLabel: 'Docket moved between queues',
      description: `Docket moved to ${destinationType}`,
      performedBy: req.user.email || req.user.xID,
      performedByXID: req.user.xID,
      actorRole: req.user.role,
      metadata: {
        source: {
          assignedToXID: docket.assignedToXID || null,
          ownerTeamId: docket.ownerTeamId ? String(docket.ownerTeamId) : null,
          workbasketId: docket.workbasketId ? String(docket.workbasketId) : null,
        },
        destination: destinationMeta,
        note: note || null,
      },
      req,
    });

    return res.json({ success: true, data: ensureUpdatedAt(updated), message: 'Docket moved' });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  isValidTransition,
  assignDocket,
  transitionDocket,
  qcAction,
  reassignDocket,
  reopenPendingDocket,
  runPendingReopen,
  moveDocket,
};
