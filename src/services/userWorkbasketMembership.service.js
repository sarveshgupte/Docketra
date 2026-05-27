const mongoose = require('mongoose');
const Team = require('../models/Team.model');

const ADMIN_LIKE_ROLES = new Set(['PRIMARY_ADMIN', 'ADMIN']);

const normalizeObjectIdStrings = (ids = []) => (
  [...new Set((Array.isArray(ids) ? ids : []).map((entry) => String(entry || '').trim()).filter(Boolean))]
);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

async function resolveFirmScopedTeams({ firmId, teamIds }) {
  const normalizedTeamIds = normalizeObjectIdStrings(teamIds);
  if (normalizedTeamIds.length === 0) return [];

  const validIds = normalizedTeamIds.filter((id) => isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (validIds.length !== normalizedTeamIds.length) {
    const error = new Error('One or more selected workbaskets are invalid or inactive');
    error.statusCode = 400;
    throw error;
  }

  const teams = await Team.find({ _id: { $in: validIds }, firmId, isActive: true }).select('_id type').lean();
  if (teams.length !== normalizedTeamIds.length) {
    const error = new Error('One or more selected workbaskets are invalid or inactive');
    error.statusCode = 400;
    throw error;
  }
  return teams;
}

function normalizeMembership({ role, teams, qcExplicitTeamIds = [], requirePrimary = false }) {
  const teamById = new Map(teams.map((t) => [String(t._id), t]));
  const primaryTeamIds = [];
  const qcTeamIds = [];
  for (const team of teams) {
    if (String(team?.type || 'PRIMARY').toUpperCase() === 'QC') qcTeamIds.push(String(team._id));
    else primaryTeamIds.push(String(team._id));
  }

  const roleUpper = String(role || '').toUpperCase();
  if (requirePrimary && roleUpper !== 'SUPER_ADMIN' && primaryTeamIds.length === 0) {
    const error = new Error('At least one PRIMARY workbasket is required for active users');
    error.statusCode = 400;
    throw error;
  }

  const explicitQc = normalizeObjectIdStrings(qcExplicitTeamIds).filter((id) => teamById.has(id) && String(teamById.get(id)?.type || 'PRIMARY').toUpperCase() === 'QC');
  const teamIds = normalizeObjectIdStrings([...primaryTeamIds, ...qcTeamIds]);

  return {
    teamId: primaryTeamIds[0] || null,
    teamIds,
    primaryTeamIds,
    qcTeamIds,
    qcExplicitTeamIds: explicitQc,
  };
}
const { normalizeRole } = require('../utils/role.utils');

function buildWorkbasketVisibilityQuery({ user }) {
  const role = normalizeRole(user?.role);
  if (role === 'SUPER_ADMIN') return { denyAll: true };
  if (ADMIN_LIKE_ROLES.has(role)) return { firmWide: true };

  const linkedIds = normalizeObjectIdStrings(user?.teamIds?.length ? user.teamIds : (user?.teamId ? [user.teamId] : []));
  if (role === 'USER') return { linkedIds };
  if (role === 'MANAGER') return { linkedIds, managerId: user?._id ? String(user._id) : null };

  return { linkedIds };
}

module.exports = {
  resolveFirmScopedTeams,
  normalizeMembership,
  buildWorkbasketVisibilityQuery,
  normalizeObjectIdStrings,
};
