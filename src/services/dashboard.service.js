const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');

const ACTIVE_DOCKET_STATUSES = ['OPEN', 'IN_PROGRESS'];
const ACTIVE_DOCKET_STATUS_SET = new Set(ACTIVE_DOCKET_STATUSES);

const normalizeStatus = (status) => String(status || '').trim().toUpperCase();

const resolveSlaBadge = (docket = {}) => {
  const now = Date.now();
  const dueAt = docket.slaDueAt || docket.dueDate;
  const dueTs = new Date(dueAt || '').getTime();

  if (!Number.isFinite(dueTs)) {
    return 'GREEN';
  }

  if (dueTs < now) {
    return 'RED';
  }

  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  if (dueTs - now <= twentyFourHoursMs) {
    return 'YELLOW';
  }

  return 'GREEN';
};

const mapDocket = (docket = {}) => ({
  _id: docket._id,
  caseInternalId: docket.caseInternalId,
  docketId: docket.caseNumber || docket.caseId,
  title: docket.caseName,
  status: docket.status,
  priority: docket.priority,
  dueDate: docket.dueDate,
  slaDueAt: docket.slaDueAt,
  slaBadge: resolveSlaBadge(docket),
  workbasketId: docket.workbasketId || docket.ownerTeamId || docket.routedToTeamId || null,
  createdAt: docket.createdAt,
  updatedAt: docket.updatedAt,
});

const buildListQuery = (firmId, query = {}) =>
  Case.find({ firmId: new mongoose.Types.ObjectId(firmId), ...query })
    .select('caseInternalId caseNumber caseId caseName status priority dueDate slaDueAt workbasketId ownerTeamId routedToTeamId createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

const getMyDockets = async (userId, firmId, { filter = 'MY', page = 1, limit = 10 } = {}) => {
  const normalizedFilter = String(filter || 'MY').trim().toUpperCase();
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;

  const assignmentFilter = {};
  if (normalizedFilter === 'MY') {
    assignmentFilter.assignedToXID = userId;
  }

  const query = {
    ...assignmentFilter,
    status: { $in: ACTIVE_DOCKET_STATUSES },
  };

  const [items, total] = await Promise.all([
    buildListQuery(firmId, query).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: new mongoose.Types.ObjectId(firmId), ...query }),
  ]);

  return {
    items: items
      .filter((docket) => ACTIVE_DOCKET_STATUS_SET.has(normalizeStatus(docket.status)))
      .map(mapDocket),
    page: pageNumber,
    limit: pageLimit,
    total,
    hasNextPage: skip + items.length < total,
    filter: normalizedFilter,
  };
};

const getOverdueDockets = async (firmId, { page = 1, limit = 10 } = {}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;
  const now = new Date();

  const query = {
    status: { $in: ACTIVE_DOCKET_STATUSES },
    $or: [
      { slaDueAt: { $lt: now } },
      { dueDate: { $lt: now } },
    ],
  };

  const [items, total] = await Promise.all([
    buildListQuery(firmId, query).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: new mongoose.Types.ObjectId(firmId), ...query }),
  ]);

  return {
    items: items.map((docket) => ({ ...mapDocket(docket), isOverdue: true })),
    page: pageNumber,
    limit: pageLimit,
    total,
    hasNextPage: skip + items.length < total,
  };
};

const getRecentDockets = async (firmId, { page = 1, limit = 10 } = {}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const skip = (pageNumber - 1) * pageLimit;

  const query = {};

  const [items, total] = await Promise.all([
    buildListQuery(firmId, query).skip(skip).limit(pageLimit),
    Case.countDocuments({ firmId: new mongoose.Types.ObjectId(firmId) }),
  ]);

  return {
    items: items.map(mapDocket),
    page: pageNumber,
    limit: pageLimit,
    total,
    hasNextPage: skip + items.length < total,
  };
};

const getWorkbasketLoad = async (firmId) => {
  const workbaskets = await Team.aggregate([
    {
      $match: {
        firmId: new mongoose.Types.ObjectId(firmId),
        parentWorkbasketId: null,
        isActive: true,
      },
    },
    {
      $lookup: {
        from: 'cases',
        let: { teamId: '$_id', teamFirmId: '$firmId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$firmId', '$$teamFirmId'] },
                  { $in: ['$status', ACTIVE_DOCKET_STATUSES] },
                  {
                    $or: [
                      { $eq: ['$workbasketId', '$$teamId'] },
                      { $eq: ['$ownerTeamId', '$$teamId'] },
                      { $eq: ['$routedToTeamId', '$$teamId'] },
                    ],
                  },
                ],
              },
            },
          },
          { $count: 'count' },
        ],
        as: 'loadStats',
      },
    },
    {
      $project: {
        _id: 0,
        workbasketId: '$_id',
        name: '$name',
        count: {
          $ifNull: [{ $arrayElemAt: ['$loadStats.count', 0] }, 0],
        },
      },
    },
    { $sort: { count: -1, name: 1 } },
  ]);

  return workbaskets;
};

module.exports = {
  getMyDockets,
  getOverdueDockets,
  getRecentDockets,
  getWorkbasketLoad,
};
