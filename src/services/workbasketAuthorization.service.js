const User = require('../models/User.model');

const ADMIN_ROLES = new Set(['ADMIN', 'PRIMARY_ADMIN']);
const MANAGER_ROLES = new Set(['MANAGER']);
const TERMINAL_STATES = new Set(['RESOLVED', 'FILED']);

const normalizeRole = (role) => String(role || '').trim().toUpperCase();
const toId = (value) => String(value || '').trim();

const resolveDocketWorkbasketId = (docket) => toId(docket?.ownerTeamId) || toId(docket?.workbasketId) || '';

const isLinkedToWorkbasket = (user, workbasketId) => {
  const target = toId(workbasketId);
  if (!target) return false;
  const ids = new Set([
    toId(user?.teamId),
    ...(Array.isArray(user?.teamIds) ? user.teamIds.map(toId) : []),
  ].filter(Boolean));
  return ids.has(target);
};

const isTerminal = (docket) => TERMINAL_STATES.has(String(docket?.status || '').toUpperCase()) || TERMINAL_STATES.has(String(docket?.state || '').toUpperCase());

const canPullFromWorkbasket = ({ user, docket }) => {
  const role = normalizeRole(user?.role);
  if (isTerminal(docket)) return false;
  if (String(docket?.assignedToXID || '').trim()) return false;
  if (String(docket?.state || '').toUpperCase() !== 'IN_WB') return false;
  if (ADMIN_ROLES.has(role)) return true;
  return isLinkedToWorkbasket(user, resolveDocketWorkbasketId(docket));
};

const canAssignFromWorkbasket = ({ actor, docket, assignee }) => {
  const role = normalizeRole(actor?.role);
  if (isTerminal(docket)) return false;
  if (ADMIN_ROLES.has(role)) return Boolean(assignee?.isActive);
  if (!MANAGER_ROLES.has(role)) return false;
  const docketWorkbasketId = resolveDocketWorkbasketId(docket);
  if (!isLinkedToWorkbasket(actor, docketWorkbasketId)) return false;
  return isLinkedToWorkbasket(assignee, docketWorkbasketId) && Boolean(assignee?.isActive);
};

const canMoveBetweenWorklists = ({ actor, docket, toUser }) => {
  const role = normalizeRole(actor?.role);
  if (isTerminal(docket)) return false;
  if (ADMIN_ROLES.has(role)) return Boolean(toUser?.isActive);
  if (!MANAGER_ROLES.has(role)) return false;
  const docketWorkbasketId = resolveDocketWorkbasketId(docket);
  if (!isLinkedToWorkbasket(actor, docketWorkbasketId)) return false;
  return isLinkedToWorkbasket(toUser, docketWorkbasketId) && Boolean(toUser?.isActive);
};

const getFirmUserByXid = (firmId, xID) => User.findOne({ firmId, xID: String(xID || '').toUpperCase(), isActive: true }).select('_id xID role teamId teamIds isActive').lean();

module.exports = { canPullFromWorkbasket, canAssignFromWorkbasket, canMoveBetweenWorklists, getFirmUserByXid, resolveDocketWorkbasketId };
