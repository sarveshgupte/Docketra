const Case = require('../models/Case.model');
const DocketSession = require('../models/DocketSession.model');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const ALL_STATES = ['IN_WB', 'IN_PROGRESS', 'IN_QC', 'PENDED', 'RESOLVED', 'FILED'];
const ALL_QC = ['PASSED', 'FAILED', 'CORRECTED'];

// TODO: cache results using Redis for heavy queries

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveLimit = (params = {}) => Math.min(Number(params.limit) || DEFAULT_LIMIT, MAX_LIMIT);

const resolveOrder = (params = {}) => (params.order === 'asc' ? 1 : -1);

const resolveSortField = (params = {}, allowedFields = [], fallbackField) => {
  const requestedField = params.sortBy;
  if (requestedField && allowedFields.includes(requestedField)) {
    return requestedField;
  }
  return fallbackField;
};

const buildDateRangeFilter = ({ fromDate, toDate, fieldName }) => {
  const start = parseDate(fromDate);
  const end = parseDate(toDate);
  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  if (!start && !end) return null;

  const filter = {};
  if (start) filter.$gte = start;
  if (end) filter.$lte = end;

  return { [fieldName]: filter };
};

const buildCaseMatch = ({ firmId, fromDate, toDate, userId, clientId, isInternal }) => {
  const match = { firmId };
  const rangeFilter = buildDateRangeFilter({ fromDate, toDate, fieldName: 'createdAt' });
  if (rangeFilter) Object.assign(match, rangeFilter);
  if (userId) match.assignedToXID = String(userId);
  if (clientId) match.clientId = String(clientId);
  if (typeof isInternal !== 'undefined') {
    match.isInternal = String(isInternal).toLowerCase() === 'true';
  }
  return match;
};

const buildSessionMatch = ({ firmId, fromDate, toDate, userId }) => {
  const match = { firmId };
  const rangeFilter = buildDateRangeFilter({ fromDate, toDate, fieldName: 'startedAt' });
  if (rangeFilter) Object.assign(match, rangeFilter);
  if (userId) match.userId = String(userId);
  return match;
};

async function getUserProductivity(params) {
  const { firmId, fromDate, toDate, userId, clientId, isInternal } = params;
  const limit = resolveLimit(params);
  const sortField = resolveSortField(params, ['totalDockets', 'resolved', 'filed'], 'totalDockets');
  const order = resolveOrder(params);

  return Case.aggregate([
    { $match: buildCaseMatch({ firmId, fromDate, toDate, userId, clientId, isInternal }) },
    {
      $group: {
        _id: '$assignedToXID',
        totalDockets: { $sum: 1 },
        resolved: {
          $sum: { $cond: [{ $eq: ['$state', 'RESOLVED'] }, 1, 0] },
        },
        filed: {
          $sum: { $cond: [{ $eq: ['$state', 'FILED'] }, 1, 0] },
        },
      },
    },
    { $sort: { [sortField]: order } },
    { $limit: limit },
  ]);
}

async function getDocketStats(params) {
  const { firmId, fromDate, toDate, userId, clientId, isInternal } = params;
  const results = await Case.aggregate([
    { $match: buildCaseMatch({ firmId, fromDate, toDate, userId, clientId, isInternal }) },
    {
      $group: {
        _id: '$state',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const resultMap = Object.fromEntries(results.map((r) => [r._id, r.count]));

  return ALL_STATES.map((state) => ({
    state,
    count: resultMap[state] || 0,
  }));
}

async function getQCPerformance(params) {
  const { firmId, fromDate, toDate, userId, clientId, isInternal } = params;
  const results = await Case.aggregate([
    {
      $match: {
        ...buildCaseMatch({ firmId, fromDate, toDate, userId, clientId, isInternal }),
        qcOutcome: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$qcOutcome',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const resultMap = Object.fromEntries(results.map((r) => [r._id, r.count]));

  return ALL_QC.map((qc) => ({
    qcOutcome: qc,
    count: resultMap[qc] || 0,
  }));
}

async function getTimePerUser(params) {
  const { firmId, fromDate, toDate, userId } = params;
  const limit = resolveLimit(params);
  const sortField = resolveSortField(params, ['totalTime'], 'totalTime');
  const order = resolveOrder(params);

  return DocketSession.aggregate([
    { $match: buildSessionMatch({ firmId, fromDate, toDate, userId }) },
    {
      $group: {
        _id: '$userId',
        totalTime: { $sum: '$activeSeconds' },
      },
    },
    { $sort: { [sortField]: order } },
    { $limit: limit },
  ]);
}

async function getClientWorkload(params) {
  const { firmId, fromDate, toDate, userId, clientId, isInternal } = params;
  const limit = resolveLimit(params);
  const sortField = resolveSortField(params, ['totalDockets'], 'totalDockets');
  const order = resolveOrder(params);

  return Case.aggregate([
    { $match: buildCaseMatch({ firmId, fromDate, toDate, userId, clientId, isInternal }) },
    {
      $group: {
        _id: '$clientId',
        totalDockets: { $sum: 1 },
      },
    },
    { $sort: { [sortField]: order } },
    { $limit: limit },
  ]);
}

async function getDocketTimeStats(params) {
  const { firmId, fromDate, toDate, userId } = params;
  const limit = resolveLimit(params);
  const sortField = resolveSortField(params, ['totalTime'], 'totalTime');
  const order = resolveOrder(params);

  return DocketSession.aggregate([
    { $match: buildSessionMatch({ firmId, fromDate, toDate, userId }) },
    {
      $group: {
        _id: '$docketId',
        totalTime: { $sum: '$activeSeconds' },
      },
    },
    { $sort: { [sortField]: order } },
    { $limit: limit },
  ]);
}

module.exports = {
  getUserProductivity,
  getDocketStats,
  getQCPerformance,
  getTimePerUser,
  getClientWorkload,
  getDocketTimeStats,
};
