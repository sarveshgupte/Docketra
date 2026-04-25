const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const { getSlaStatus } = require('./sla.service');
const { enqueueSlaCheckJob } = require('../queues/slaCheck.queue');
const log = require('../utils/log');
const { logSlowEndpoint } = require('../utils/slowLog');

const ACTIVE_DOCKET_STATUSES = ['OPEN', 'IN_PROGRESS'];
const ACTIVE_DOCKET_STATUS_SET = new Set(ACTIVE_DOCKET_STATUSES);
const SORT_OPTIONS = new Set(['NEWEST', 'PRIORITY', 'SLA']);
const DASHBOARD_LIST_PROJECTION = 'caseInternalId caseNumber caseId title caseName status priority dueDate slaDueAt workbasketId ownerTeamId routedToTeamId createdAt updatedAt';
const SLOW_DASHBOARD_QUERY_MS = 350;

const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
const normalizeSort = (sort) => {
  const normalized = String(sort || 'NEWEST').trim().toUpperCase();
  return SORT_OPTIONS.has(normalized) ? normalized : 'NEWEST';
};

const resolveSort = (sort = 'NEWEST') => {
  const normalized = normalizeSort(sort);
  if (normalized === 'PRIORITY') {
    return { priorityRank: -1, createdAt: -1, _id: 1 };
  }
  if (normalized === 'SLA') {
    return { slaDueAt: 1, dueDate: 1, createdAt: -1, _id: 1 };
  }
  return { createdAt: -1, _id: 1 };
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

const buildListQuery = (firmObjectId, query = {}, sort = 'NEWEST') =>
  Case.find({ firmId: firmObjectId, ...query })
    .select(DASHBOARD_LIST_PROJECTION)
    .sort(resolveSort(sort))
    .lean();

const logSlowDashboardQuery = ({ queryName, firmId, durationMs, page, limit, requestId = null, userXID = null }) => {
  logSlowEndpoint({
    marker: '[DASHBOARD_QUERY_SLOW]',
    thresholdMs: SLOW_DASHBOARD_QUERY_MS,
    durationMs,
    req: requestId ? { requestId } : null,
    firmId,
    userXID,
    queryCategoryFlags: { queryName },
    pagination: { page, limit },
  });
};

const getMyDockets = async (userId, firmId, { filter = 'MY', page = 1, limit = 10, sort = 'NEWEST', workbasketId = null } = {}) => {
  const startedAt = Date.now();
  const normalizedFilter = String(filter || 'MY').trim().toUpperCase();
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;

  const assignmentFilter = normalizedFilter === 'MY' ? { assignedToXID: userId } : {};
  const workbasketFilter = workbasketId
    ? { $or: [{ workbasketId }, { ownerTeamId: workbasketId }, { routedToTeamId: workbasketId }] }
    : {};

  const query = { ...assignmentFilter, ...workbasketFilter, status: { $in: ACTIVE_DOCKET_STATUSES } };
  const firmObjectId = new mongoose.Types.ObjectId(firmId);

  const [items, total] = await Promise.all([
    buildListQuery(firmObjectId, query, sort).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: firmObjectId, ...query }),
  ]);
  logSlowDashboardQuery({
    queryName: 'getMyDockets',
    firmId,
    durationMs: Date.now() - startedAt,
    page: pageNumber,
    limit: pageLimit,
  });

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
  const startedAt = Date.now();
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;
  const now = new Date();

  const query = {
    status: { $in: ACTIVE_DOCKET_STATUSES },
    ...(workbasketId ? { $or: [{ workbasketId }, { ownerTeamId: workbasketId }, { routedToTeamId: workbasketId }] } : {}),
    $or: [{ slaDueAt: { $lt: now } }, { dueDate: { $lt: now } }],
  };
  const firmObjectId = new mongoose.Types.ObjectId(firmId);

  const [items, total] = await Promise.all([
    buildListQuery(firmObjectId, query, sort).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: firmObjectId, ...query }),
  ]);
  logSlowDashboardQuery({
    queryName: 'getOverdueDockets',
    firmId,
    durationMs: Date.now() - startedAt,
    page: pageNumber,
    limit: pageLimit,
  });

  const mappedItems = items.map((docket) => ({ ...mapDocket(docket), isOverdue: true }));
  enqueueSlaCheckJob({ firmId }).catch((err) => {
    log.warn('SLA_CHECK_ENQUEUE_FAILED', { firmId, error: err.message });
  });

  return { items: mappedItems, page: pageNumber, limit: pageLimit, total, hasNextPage: skip + items.length < total, sort: normalizeSort(sort) };
};

const getRecentDockets = async (firmId, { page = 1, limit = 10, sort = 'NEWEST', workbasketId = null } = {}) => {
  const startedAt = Date.now();
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;
  const query = workbasketId ? { $or: [{ workbasketId }, { ownerTeamId: workbasketId }, { routedToTeamId: workbasketId }] } : {};
  const firmObjectId = new mongoose.Types.ObjectId(firmId);

  const [items, total] = await Promise.all([
    buildListQuery(firmObjectId, query, sort).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: firmObjectId, ...query }),
  ]);
  logSlowDashboardQuery({
    queryName: 'getRecentDockets',
    firmId,
    durationMs: Date.now() - startedAt,
    page: pageNumber,
    limit: pageLimit,
  });

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
