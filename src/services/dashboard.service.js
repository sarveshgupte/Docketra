const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const { getSlaStatus, syncSlaBreachNotifications } = require('./sla.service');

const ACTIVE_DOCKET_STATUSES = ['OPEN', 'IN_PROGRESS'];
const ACTIVE_DOCKET_STATUS_SET = new Set(ACTIVE_DOCKET_STATUSES);
const SORT_OPTIONS = new Set(['NEWEST', 'PRIORITY', 'SLA']);

const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
const normalizeSort = (sort) => {
  const normalized = String(sort || 'NEWEST').trim().toUpperCase();
  return SORT_OPTIONS.has(normalized) ? normalized : 'NEWEST';
};

const resolveSort = (sort = 'NEWEST') => {
  const normalized = normalizeSort(sort);
  if (normalized === 'PRIORITY') {
    return { priorityRank: -1, createdAt: -1 };
  }
  if (normalized === 'SLA') {
    return { slaDueAt: 1, dueDate: 1, createdAt: -1 };
  }
  return { createdAt: -1 };
};

const resolveSlaBadge = (docket = {}) => getSlaStatus(docket);

const normalizePriorityRank = (priority) => {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'HIGH') return 3;
  if (normalized === 'MEDIUM') return 2;
  if (normalized === 'LOW') return 1;
  return 0;
};

const mapDocket = (docket = {}) => ({
  _id: docket._id,
  caseInternalId: docket.caseInternalId,
  docketId: docket.caseNumber || docket.caseId,
  title: docket.title || docket.caseName,
  status: docket.status,
  priority: docket.priority,
  dueDate: docket.dueDate,
  slaDueAt: docket.slaDueAt,
  slaDueDate: docket.slaDueAt || docket.dueDate || null,
  slaStatus: resolveSlaBadge(docket),
  slaBadge: resolveSlaBadge(docket),
  workbasketId: docket.workbasketId || docket.ownerTeamId || docket.routedToTeamId || null,
  createdAt: docket.createdAt,
  updatedAt: docket.updatedAt,
});

const buildListQuery = (firmId, query = {}, sort = 'NEWEST') =>
  Case.find({ firmId: new mongoose.Types.ObjectId(firmId), ...query })
    .select('caseInternalId caseNumber caseId title caseName status priority dueDate slaDueAt workbasketId ownerTeamId routedToTeamId createdAt updatedAt')
    .sort(resolveSort(sort))
    .lean();

const getMyDockets = async (userId, firmId, { filter = 'MY', page = 1, limit = 10, sort = 'NEWEST', workbasketId = null } = {}) => {
  const normalizedFilter = String(filter || 'MY').trim().toUpperCase();
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;

  const assignmentFilter = normalizedFilter === 'MY' ? { assignedToXID: userId } : {};
  const workbasketFilter = workbasketId
    ? { $or: [{ workbasketId }, { ownerTeamId: workbasketId }, { routedToTeamId: workbasketId }] }
    : {};

  const query = { ...assignmentFilter, ...workbasketFilter, status: { $in: ACTIVE_DOCKET_STATUSES } };

  const [items, total] = await Promise.all([
    buildListQuery(firmId, query, sort).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: new mongoose.Types.ObjectId(firmId), ...query }),
  ]);

  return {
    items: items
      .filter((docket) => ACTIVE_DOCKET_STATUS_SET.has(normalizeStatus(docket.status)))
      .map((docket) => ({ ...mapDocket(docket), priorityRank: normalizePriorityRank(docket.priority) })),
    page: pageNumber,
    limit: pageLimit,
    total,
    hasNextPage: skip + items.length < total,
    filter: normalizedFilter,
    sort: normalizeSort(sort),
  };
};

const getOverdueDockets = async (firmId, { page = 1, limit = 10, sort = 'NEWEST', workbasketId = null } = {}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;
  const now = new Date();

  const query = {
    status: { $in: ACTIVE_DOCKET_STATUSES },
    ...(workbasketId ? { $or: [{ workbasketId }, { ownerTeamId: workbasketId }, { routedToTeamId: workbasketId }] } : {}),
    $or: [{ slaDueAt: { $lt: now } }, { dueDate: { $lt: now } }],
  };

  const [items, total] = await Promise.all([
    buildListQuery(firmId, query, sort).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: new mongoose.Types.ObjectId(firmId), ...query }),
  ]);

  const mappedItems = items.map((docket) => ({ ...mapDocket(docket), isOverdue: true }));
  await syncSlaBreachNotifications(mappedItems, { firmId, now });

  return { items: mappedItems, page: pageNumber, limit: pageLimit, total, hasNextPage: skip + items.length < total, sort: normalizeSort(sort) };
};

const getRecentDockets = async (firmId, { page = 1, limit = 10, sort = 'NEWEST', workbasketId = null } = {}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;
  const query = workbasketId ? { $or: [{ workbasketId }, { ownerTeamId: workbasketId }, { routedToTeamId: workbasketId }] } : {};

  const [items, total] = await Promise.all([
    buildListQuery(firmId, query, sort).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: new mongoose.Types.ObjectId(firmId), ...query }),
  ]);

  return { items: items.map(mapDocket), page: pageNumber, limit: pageLimit, total, hasNextPage: skip + items.length < total, sort: normalizeSort(sort) };
};

const getWorkbasketLoad = async (firmId) => {
  const [workbaskets, counts] = await Promise.all([
    Team.find({ firmId: new mongoose.Types.ObjectId(firmId), parentWorkbasketId: null, isActive: true }).select('_id name').lean(),
    Case.aggregate([
      {
        $match: {
          firmId: new mongoose.Types.ObjectId(firmId),
          status: { $in: ACTIVE_DOCKET_STATUSES },
        },
      },
      {
        $project: {
          workbasketId: { $ifNull: ['$workbasketId', { $ifNull: ['$ownerTeamId', '$routedToTeamId'] }] },
        },
      },
      { $match: { workbasketId: { $ne: null } } },
      { $group: { _id: '$workbasketId', count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  return workbaskets
    .map((workbasket) => ({
      workbasketId: workbasket._id,
      name: workbasket.name,
      count: countMap.get(String(workbasket._id)) || 0,
    }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
};

module.exports = { getMyDockets, getOverdueDockets, getRecentDockets, getWorkbasketLoad };
