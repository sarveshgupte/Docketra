const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const DocketRoute = require('../models/DocketRoute.model');
const CaseStatus = require('../domain/case/caseStatus');
const { NotificationTypes, createNotification } = require('../domain/notifications');

const makeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const findDocket = async ({ docketId, firmId }) => {
  const docket = await Case.findOne({ caseId: docketId, firmId });
  if (!docket) throw makeError('Docket not found', 404);
  return docket;
};

const isAdmin = (role) => ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(String(role || '').toUpperCase());

async function routeDocket({ docketId, actor, firmId, toTeamId, note }) {
  const docket = await findDocket({ docketId, firmId });
  const actorTeam = String(actor.teamId || '');
  if (!actorTeam) throw makeError('User does not belong to any team', 400);

  if (!isAdmin(actor.role) && String(docket.ownerTeamId || '') !== actorTeam) {
    throw makeError('Only owner team or admin can route docket', 403);
  }
  if (docket.routedToTeamId) {
    throw makeError('Docket is already routed', 409);
  }

  const targetTeam = await Team.findOne({ _id: toTeamId, firmId }).select('_id name').lean();
  if (!targetTeam) throw makeError('Target team not found', 404);
  if (String(docket.ownerTeamId || '') === String(toTeamId)) throw makeError('Cannot route to owner team', 400);

  docket.routedToTeamId = targetTeam._id;
  docket.routedByUserId = String(actor.xID || '').toUpperCase();
  docket.routedAt = new Date();
  docket.routingNote = note || null;
  docket.status = CaseStatus.ROUTED || 'ROUTED';
  await docket.save();

  await DocketRoute.create({
    docketId,
    fromTeamId: docket.ownerTeamId,
    toTeamId: targetTeam._id,
    routedBy: String(actor.xID || '').toUpperCase(),
    routedAt: docket.routedAt,
    note: note || null,
    firmId,
  });

  await createNotification({
    firmId,
    userId: String(actor.xID || '').toUpperCase(),
    type: NotificationTypes.LIFECYCLE_CHANGED,
    docketId,
    actor,
    timestamp: new Date(),
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
  if (!docket.routedToTeamId || String(docket.routedToTeamId) !== String(actor.teamId || '')) {
    throw makeError('Only routed team can return docket', 403);
  }

  const activeRoute = await DocketRoute.findOne({ docketId, firmId, returnedAt: null }).sort({ routedAt: -1 });
  if (activeRoute) {
    activeRoute.returnedAt = new Date();
    if (note) activeRoute.note = `${activeRoute.note || ''}\nReturn note: ${note}`.trim();
    await activeRoute.save();
  }

  docket.routedToTeamId = null;
  docket.status = CaseStatus.RETURNED || 'RETURNED';
  if (note) docket.routingNote = note;
  await docket.save();
  return docket;
}

async function transitionRoutedTeamStatus({ docketId, actor, firmId, status }) {
  const docket = await findDocket({ docketId, firmId });
  const allowed = new Set([CaseStatus.IN_PROGRESS, CaseStatus.PENDING, CaseStatus.FILED]);
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

module.exports = {
  routeDocket,
  acceptRoutedDocket,
  returnRoutedDocket,
  transitionRoutedTeamStatus,
  resolveDocketWithTeamRestriction,
};
