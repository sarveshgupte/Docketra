const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const { getSlaStatus } = require('./sla.service');
const { enqueueSlaCheckJob } = require('../queues/slaCheck.queue');
const log = require('../utils/log');
const { logSlowEndpoint } = require('../utils/slowLog');
const { COMPLIANCE_STATES, normalizeComplianceState, canComplianceTransition } = require('../domain/compliance/complianceStateMachine');
const { getApprovalQueueFilter, sendApprovalReminderPlaceholder } = require('./docketApproval.service');

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

const getRiskBrief = async (firmId) => {
  const firmObjectId = new mongoose.Types.ObjectId(firmId);
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
  const activeStatuses = ['OPEN', 'IN_PROGRESS', 'PENDING', 'UNDER_REVIEW', 'SUBMITTED', 'REVIEWED'];

  const [
    atRiskEntities,
    waitingClient,
    awaitingApproval,
    overloadedAssigneesRaw,
    blockedTaxonomyRaw,
    stalePending,
  ] = await Promise.all([
    Case.countDocuments({
      firmId: firmObjectId,
      status: { $in: activeStatuses },
      $or: [
        { slaDueAt: { $lt: now } },
        { dueDate: { $lt: now } },
      ],
    }),
    Case.countDocuments({
      firmId: firmObjectId,
      status: 'PENDING',
      pendingReason: 'waiting_client',
    }),
    Case.countDocuments({
      firmId: firmObjectId,
      status: { $in: ['UNDER_REVIEW', 'SUBMITTED', 'REVIEWED'] },
    }),
    Case.aggregate([
      {
        $match: {
          firmId: firmObjectId,
          status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
          assignedToXID: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$assignedToXID', docketCount: { $sum: 1 } } },
      { $match: { docketCount: { $gte: 10 } } },
      { $sort: { docketCount: -1 } },
      { $limit: 5 },
    ]),
    Case.aggregate([
      {
        $match: {
          firmId: firmObjectId,
          status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
          $or: [
            { pendingReason: 'blocked' },
            { blockerType: { $exists: true, $ne: null } },
          ],
        },
      },
      {
        $project: {
          blockerKey: {
            $ifNull: ['$blockerType', '$pendingReason'],
          },
        },
      },
      {
        $group: {
          _id: '$blockerKey',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    // 💡 What: Moved stalePending countDocuments query into the preceding Promise.all array.
    // 🎯 Why: This turns a sequential database call into a concurrent one, reducing overall latency by executing it in parallel with the other risk aggregations.
    Case.countDocuments({
      firmId: firmObjectId,
      status: 'PENDING',
      updatedAt: { $lt: tenDaysAgo },
    }),
  ]);

  const blockedByType = blockedTaxonomyRaw.reduce((acc, item) => {
    const key = String(item?._id || 'other');
    acc[key] = Number(item?.count || 0);
    return acc;
  }, {});

  return {
    atRiskEntities,
    waitingClient,
    stalePending,
    awaitingApproval,
    overloadedAssignees: overloadedAssigneesRaw.map((row) => ({
      assigneeXID: row._id,
      docketCount: row.docketCount,
    })),
    blockedByType,
  };
};

const ACTIVE_COMPLIANCE_STATES = new Set([
  COMPLIANCE_STATES.NOT_STARTED,
  COMPLIANCE_STATES.IN_PROGRESS,
  COMPLIANCE_STATES.AWAITING_CLIENT,
  COMPLIANCE_STATES.AWAITING_PARTNER,
  COMPLIANCE_STATES.READY_TO_FILE,
  COMPLIANCE_STATES.BLOCKED,
]);

const MORNING_EXCEPTION_TYPES = new Set([
  'portal_issue',
  'DSC_authorisation_pending',
  'client_delay',
  'query_raised',
  'other',
]);

const NORMALIZED_RISK_LEVELS = new Set(['high', 'critical']);
const NORMALIZED_PRIORITY_LEVELS = new Set(['high', 'urgent']);

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const daysBetween = (from, to) => {
  const fromDate = toDate(from);
  const toDateValue = toDate(to);
  if (!fromDate || !toDateValue) return null;
  return Math.max(0, Math.floor((toDateValue.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)));
};

const normalizeXid = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
};

const resolveDueDate = (row = {}) => toDate(row.internal_due_date) || toDate(row.statutory_due_date) || null;

const toCaseListItem = (row = {}, now = new Date()) => {
  const dueDate = resolveDueDate(row);
  const isOverdue = Boolean(dueDate && dueDate < now);
  const dueSoonBoundary = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  const isDueSoon = Boolean(dueDate && dueDate >= now && dueDate <= dueSoonBoundary);
  const riskLevel = String(row.risk_level || 'medium').trim().toLowerCase();
  const priority = String(row.priority || 'medium').trim().toLowerCase();
  return {
    caseId: row.caseId || row.caseNumber,
    title: row.title || '',
    clientId: row.clientId || '',
    clientName: row.clientSnapshot?.businessName || '',
    entityName: row.clientSnapshot?.businessName || row.clientId || '',
    assignedToXID: row.assignedToXID || null,
    complianceState: row.compliance_state || COMPLIANCE_STATES.NOT_STARTED,
    obligationType: row.obligation_type || '',
    obligationPeriod: row.obligation_period || '',
    status: row.status || 'OPEN',
    riskLevel,
    priority,
    blockedReason: row.blocked_reason || '',
    blockerType: row.blockerType || null,
    pendingReason: row.pendingReason || null,
    statutoryDueDate: row.statutory_due_date || null,
    internalDueDate: row.internal_due_date || null,
    dueDate: dueDate || null,
    pendUntil: row.pend_until || null,
    blockedAt: row.blockedAt || null,
    updatedAt: row.updatedAt || null,
    createdAt: row.createdAt || null,
    approvalStage: row.approval_stage || null,
    dueRisk: isOverdue ? 'overdue' : (isDueSoon ? 'due_soon' : 'on_track'),
    isOverdue,
    isDueSoon,
    isHighRisk: NORMALIZED_RISK_LEVELS.has(riskLevel) || NORMALIZED_PRIORITY_LEVELS.has(priority),
  };
};

const classifyExceptionType = (item = {}) => {
  const blockerType = String(item.blockerType || '').trim().toLowerCase();
  const text = String(item.blockedReason || '').trim().toLowerCase();
  if (blockerType === 'portal_error' || /(portal|gstn|mca|traces|site down|server)/i.test(text)) {
    return 'portal_issue';
  }
  if (blockerType === 'dsc' || blockerType === 'signatory' || /(dsc|digital signature|signatory|authorization|authorisation)/i.test(text)) {
    return 'DSC_authorisation_pending';
  }
  if (blockerType === 'client_documents' || item.pendingReason === 'waiting_client' || /(awaiting client|client delay|missing document|documents pending|awaiting document)/i.test(text)) {
    return 'client_delay';
  }
  if (/(query|clarification|notice|raised)/i.test(text)) {
    return 'query_raised';
  }
  return 'other';
};

const getPartnerMorningDashboard = async (firmId, filters = {}) => {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  const firmObjectId = new mongoose.Types.ObjectId(firmId);

  const andFilters = [];
  if (filters.assigneeXID) andFilters.push({ assignedToXID: normalizeXid(filters.assigneeXID) });
  if (filters.clientId) andFilters.push({ clientId: String(filters.clientId).trim() });
  if (filters.obligationType) andFilters.push({ obligation_type: String(filters.obligationType).trim() });
  if (filters.riskLevel) andFilters.push({ risk_level: String(filters.riskLevel).trim().toLowerCase() });
  if (filters.approverXID) andFilters.push({ 'approval_stage.approver': normalizeXid(filters.approverXID) });
  const normalizedState = normalizeComplianceState(filters.state);
  if (normalizedState) andFilters.push({ compliance_state: normalizedState });
  if (filters.dueFrom || filters.dueTo) {
    const dueFilter = {};
    if (filters.dueFrom) {
      const dueFromDate = toDate(filters.dueFrom);
      if (dueFromDate) dueFilter.$gte = dueFromDate;
    }
    if (filters.dueTo) {
      const dueToDate = toDate(filters.dueTo);
      if (dueToDate) dueFilter.$lte = dueToDate;
    }
    if (Object.keys(dueFilter).length) {
      andFilters.push({
        $or: [
          { internal_due_date: dueFilter },
          { statutory_due_date: dueFilter },
        ],
      });
    }
  }

  const match = {
    firmId: firmObjectId,
    ...(andFilters.length ? { $and: andFilters } : {}),
  };

  const rows = await Case.find(match)
    .select('caseId caseNumber title clientId clientSnapshot assignedToXID compliance_state statutory_due_date internal_due_date obligation_type obligation_period risk_level priority blocked_reason blockerType pendingReason status approval_stage pend_until blockedAt createdAt updatedAt')
    .sort({ internal_due_date: 1, statutory_due_date: 1, createdAt: -1 })
    .limit(1200)
    .lean();

  const items = rows.map((row) => toCaseListItem(row, now));

  const activeItems = items.filter((item) => ACTIVE_COMPLIANCE_STATES.has(item.complianceState));
  const atRiskEntities = activeItems
    .filter((item) => item.isHighRisk && (item.isOverdue || item.isDueSoon))
    .sort((a, b) => {
      const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return dueA - dueB;
    })
    .slice(0, 200);

  const clientBlockerMap = new Map();
  items.filter((item) => item.complianceState === COMPLIANCE_STATES.AWAITING_CLIENT).forEach((item) => {
    const key = `${item.clientId || 'NO_CLIENT'}|${item.entityName || 'Unknown Entity'}`;
    const existing = clientBlockerMap.get(key) || {
      clientId: item.clientId || '',
      clientName: item.clientName || '',
      entityName: item.entityName || '',
      docketCount: 0,
      overdueCount: 0,
      maxAgeDays: 0,
      dockets: [],
    };
    const ageDays = daysBetween(item.updatedAt || item.createdAt, now) || 0;
    existing.docketCount += 1;
    if (item.isOverdue) existing.overdueCount += 1;
    existing.maxAgeDays = Math.max(existing.maxAgeDays, ageDays);
    if (existing.dockets.length < 4) {
      existing.dockets.push({
        caseId: item.caseId,
        title: item.title,
        obligationType: item.obligationType,
        dueDate: item.dueDate,
        ageDays,
        dueRisk: item.dueRisk,
      });
    }
    clientBlockerMap.set(key, existing);
  });
  const clientBlockers = [...clientBlockerMap.values()].sort((a, b) => (b.maxAgeDays - a.maxAgeDays) || (b.docketCount - a.docketCount));

  const approvalPendingItems = items.filter((item) => String(item?.approvalStage?.status || '').toLowerCase() === 'pending');
  const approvalBlockerMap = new Map();
  approvalPendingItems.forEach((item) => {
    const approver = normalizeXid(item?.approvalStage?.approver) || 'UNASSIGNED_APPROVER';
    const existing = approvalBlockerMap.get(approver) || {
      approver,
      docketCount: 0,
      overdueCount: 0,
      maxAgeDays: 0,
      awaitingPartnerCount: 0,
      awaitingClientSignatoryCount: 0,
      dockets: [],
    };
    const requestedAt = toDate(item?.approvalStage?.requested_at) || item.updatedAt || item.createdAt;
    const dueAt = toDate(item?.approvalStage?.due_at);
    const ageDays = daysBetween(requestedAt, now) || 0;
    existing.docketCount += 1;
    if (dueAt && dueAt < now) existing.overdueCount += 1;
    const approvalType = String(item?.approvalStage?.approval_type || '').toLowerCase();
    if (approvalType === 'internal_partner') existing.awaitingPartnerCount += 1;
    if (approvalType === 'client' || approvalType === 'authorised_signatory') existing.awaitingClientSignatoryCount += 1;
    existing.maxAgeDays = Math.max(existing.maxAgeDays, ageDays);
    if (existing.dockets.length < 4) {
      existing.dockets.push({
        caseId: item.caseId,
        title: item.title,
        approvalType,
        dueAt: dueAt || null,
        ageDays,
        dueRisk: dueAt ? (dueAt < now ? 'overdue' : 'on_track') : 'on_track',
      });
    }
    approvalBlockerMap.set(approver, existing);
  });
  const approvalBlockers = [...approvalBlockerMap.values()].sort((a, b) => (b.maxAgeDays - a.maxAgeDays) || (b.overdueCount - a.overdueCount));

  const teamLoadMap = new Map();
  activeItems.forEach((item) => {
    const assignee = normalizeXid(item.assignedToXID) || 'UNASSIGNED';
    const existing = teamLoadMap.get(assignee) || {
      assigneeXID: assignee,
      openDockets: 0,
      dueThisWeek: 0,
      overdue: 0,
      blocked: 0,
      awaitingExternalInput: 0,
      highRiskOpen: 0,
      overloaded: false,
    };
    existing.openDockets += 1;
    if (item.dueDate && item.dueDate >= now && item.dueDate <= weekEnd) existing.dueThisWeek += 1;
    if (item.isOverdue) existing.overdue += 1;
    if (item.complianceState === COMPLIANCE_STATES.BLOCKED) existing.blocked += 1;
    if (
      item.complianceState === COMPLIANCE_STATES.AWAITING_CLIENT
      || item.complianceState === COMPLIANCE_STATES.AWAITING_PARTNER
      || String(item?.approvalStage?.status || '').toLowerCase() === 'pending'
    ) {
      existing.awaitingExternalInput += 1;
    }
    if (item.isHighRisk) existing.highRiskOpen += 1;
    teamLoadMap.set(assignee, existing);
  });
  const teamLoad = [...teamLoadMap.values()]
    .map((row) => ({
      ...row,
      overloaded: row.openDockets >= 10 || row.overdue >= 3 || row.awaitingExternalInput >= 5,
    }))
    .sort((a, b) => {
      if (a.overloaded !== b.overloaded) return a.overloaded ? -1 : 1;
      return (b.openDockets - a.openDockets) || (b.overdue - a.overdue);
    });

  const normalizedExceptionFilter = MORNING_EXCEPTION_TYPES.has(String(filters.exceptionType || '').trim())
    ? String(filters.exceptionType).trim()
    : '';
  const blockedCandidates = items.filter((item) => (
    item.complianceState === COMPLIANCE_STATES.BLOCKED
    || item.pendingReason === 'blocked'
    || Boolean(item.blockerType)
    || Boolean(item.blockedReason)
  ));
  const blockedByException = blockedCandidates.map((item) => ({
    ...item,
    exceptionType: classifyExceptionType(item),
  })).filter((item) => !normalizedExceptionFilter || item.exceptionType === normalizedExceptionFilter);

  const exceptionMap = new Map();
  blockedByException.forEach((item) => {
    const key = item.exceptionType;
    const existing = exceptionMap.get(key) || {
      reason: key,
      docketCount: 0,
      overdueCount: 0,
      maxAgeDays: 0,
      dockets: [],
    };
    const ageDays = daysBetween(item.blockedAt || item.updatedAt || item.createdAt, now) || 0;
    existing.docketCount += 1;
    if (item.isOverdue) existing.overdueCount += 1;
    existing.maxAgeDays = Math.max(existing.maxAgeDays, ageDays);
    if (existing.dockets.length < 4) {
      existing.dockets.push({
        caseId: item.caseId,
        title: item.title,
        blockedReason: item.blockedReason || '',
        blockerType: item.blockerType || null,
        ageDays,
        dueRisk: item.dueRisk,
      });
    }
    exceptionMap.set(key, existing);
  });
  const exceptions = [...exceptionMap.values()].sort((a, b) => (b.docketCount - a.docketCount) || (b.maxAgeDays - a.maxAgeDays));

  return {
    summary: {
      atRiskEntities: atRiskEntities.length,
      clientsBlocking: clientBlockers.length,
      filingsAwaitingApproval: approvalPendingItems.length,
      overloadedTeamMembers: teamLoad.filter((row) => row.overloaded).length,
      exceptionBlockedFilings: blockedByException.length,
    },
    filtersApplied: {
      assigneeXID: filters.assigneeXID || '',
      clientId: filters.clientId || '',
      obligationType: filters.obligationType || '',
      state: normalizedState || '',
      dueFrom: filters.dueFrom || '',
      dueTo: filters.dueTo || '',
      riskLevel: filters.riskLevel || '',
      approverXID: filters.approverXID || '',
      exceptionType: normalizedExceptionFilter,
    },
    sections: {
      atRiskEntities,
      clientBlockers,
      approvalBlockers,
      teamLoad,
      exceptions,
    },
  };
};

const getComplianceControlRoom = async (firmId, filters = {}) => {
  const firmObjectId = new mongoose.Types.ObjectId(firmId);
  const now = new Date();
  const weekEnd = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  const recentFiledStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

  const andFilters = [];
  if (filters.assigneeXID) andFilters.push({ assignedToXID: String(filters.assigneeXID).trim().toUpperCase() });
  if (filters.clientId) andFilters.push({ clientId: String(filters.clientId).trim() });
  if (filters.obligationType) andFilters.push({ obligation_type: String(filters.obligationType).trim() });
  if (filters.riskLevel) andFilters.push({ risk_level: String(filters.riskLevel).trim().toLowerCase() });
  const normalizedState = normalizeComplianceState(filters.state);
  if (normalizedState) andFilters.push({ compliance_state: normalizedState });
  if (filters.dueFrom || filters.dueTo) {
    const dueFilter = {};
    if (filters.dueFrom) {
      const dueFromDate = new Date(filters.dueFrom);
      if (!Number.isNaN(dueFromDate.getTime())) dueFilter.$gte = dueFromDate;
    }
    if (filters.dueTo) {
      const dueToDate = new Date(filters.dueTo);
      if (!Number.isNaN(dueToDate.getTime())) dueFilter.$lte = dueToDate;
    }
    if (Object.keys(dueFilter).length) {
      andFilters.push({
        $or: [
          { statutory_due_date: dueFilter },
          { internal_due_date: dueFilter },
        ],
      });
    }
  }

  const match = {
    firmId: firmObjectId,
    ...(andFilters.length ? { $and: andFilters } : {}),
  };

  // ⚡ Bolt: Revert $facet for simple counts
  // 💡 What: Replaced memory-intensive $facet aggregation with concurrent Case.countDocuments() queries via Promise.all().
  // 🎯 Why: $facet forces MongoDB to pull all matching documents into memory to evaluate sub-pipelines, bypassing indexes and risking the 100MB memory limit. Individual countDocuments queries can resolve using fast index scans.
  const [
    dueThisWeek,
    overdue,
    awaitingClient,
    awaitingPartner,
    readyToFile,
    blocked,
    filedRecently,
    items,
  ] = await Promise.all([
    Case.countDocuments({
      ...match,
      compliance_state: { $in: Array.from(ACTIVE_COMPLIANCE_STATES) },
      $or: [
        { statutory_due_date: { $gte: now, $lte: weekEnd } },
        { internal_due_date: { $gte: now, $lte: weekEnd } },
      ],
    }),
    Case.countDocuments({
      ...match,
      compliance_state: { $in: Array.from(ACTIVE_COMPLIANCE_STATES) },
      $or: [
        { statutory_due_date: { $lt: now } },
        { internal_due_date: { $lt: now } },
      ],
    }),
    Case.countDocuments({ ...match, compliance_state: COMPLIANCE_STATES.AWAITING_CLIENT }),
    Case.countDocuments({ ...match, compliance_state: COMPLIANCE_STATES.AWAITING_PARTNER }),
    Case.countDocuments({ ...match, compliance_state: COMPLIANCE_STATES.READY_TO_FILE }),
    Case.countDocuments({ ...match, compliance_state: COMPLIANCE_STATES.BLOCKED }),
    Case.countDocuments({
      ...match,
      compliance_state: COMPLIANCE_STATES.FILED,
      filed_at: { $gte: recentFiledStart, $lte: now },
    }),
    Case.find(match)
      .select('caseId caseNumber title clientId clientName assignedToXID approver_xid reviewer_xid compliance_state statutory_due_date internal_due_date pend_until filed_at obligation_type obligation_period risk_level blocked_reason priority status')
      .sort({ statutory_due_date: 1, internal_due_date: 1, createdAt: -1 })
      .limit(300)
      .lean(),
  ]);

  const summaryPayload = {
    dueThisWeek: dueThisWeek || 0,
    overdue: overdue || 0,
    awaitingClient: awaitingClient || 0,
    awaitingPartner: awaitingPartner || 0,
    readyToFile: readyToFile || 0,
    blocked: blocked || 0,
    filedRecently: filedRecently || 0,
  };
  const itemsPayload = items.map((item) => ({
    caseId: item.caseId || item.caseNumber,
    title: item.title,
    clientId: item.clientId || '',
    clientName: item.clientName || '',
    assignedToXID: item.assignedToXID || null,
    reviewerXID: item.reviewer_xid || null,
    approverXID: item.approver_xid || null,
    complianceState: item.compliance_state || COMPLIANCE_STATES.NOT_STARTED,
    statutoryDueDate: item.statutory_due_date || null,
    internalDueDate: item.internal_due_date || null,
    pendUntil: item.pend_until || null,
    filedAt: item.filed_at || null,
    obligationType: item.obligation_type || '',
    obligationPeriod: item.obligation_period || '',
    riskLevel: item.risk_level || 'medium',
    blockedReason: item.blocked_reason || '',
    priority: item.priority || 'medium',
    status: item.status || 'OPEN',
  }));

  if (filters.useDemo === true && itemsPayload.length === 0) {
    const today = new Date();
    const plusDays = (days) => new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));
    return {
      summary: {
        dueThisWeek: 2,
        overdue: 1,
        awaitingClient: 1,
        awaitingPartner: 0,
        readyToFile: 1,
        blocked: 1,
        filedRecently: 1,
      },
      items: [
        { caseId: 'CASE-DEMO-0001', title: 'GSTR-3B May 2026', clientId: 'C001001', clientName: 'Aarohan Private Limited', assignedToXID: 'X000121', reviewerXID: 'X000075', approverXID: 'X000010', complianceState: 'awaiting_client', statutoryDueDate: plusDays(2), internalDueDate: plusDays(1), pendUntil: plusDays(1), filedAt: null, obligationType: 'GST', obligationPeriod: 'May-2026', riskLevel: 'high', blockedReason: 'Awaiting purchase register and missing invoice copies', priority: 'high', status: 'PENDING' },
        { caseId: 'CASE-DEMO-0002', title: 'MGT-7 Annual Return', clientId: 'C001114', clientName: 'Nirmaan Foods LLP', assignedToXID: 'X000132', reviewerXID: 'X000081', approverXID: 'X000010', complianceState: 'ready_to_file', statutoryDueDate: plusDays(1), internalDueDate: today, pendUntil: null, filedAt: null, obligationType: 'ROC', obligationPeriod: 'FY 2025-26', riskLevel: 'critical', blockedReason: '', priority: 'urgent', status: 'OPEN' },
        { caseId: 'CASE-DEMO-0003', title: 'TDS 24Q Q4', clientId: 'C001032', clientName: 'Saarthi Ventures', assignedToXID: 'X000121', reviewerXID: 'X000075', approverXID: 'X000010', complianceState: 'blocked', statutoryDueDate: plusDays(-1), internalDueDate: plusDays(-3), pendUntil: null, filedAt: null, obligationType: 'TDS', obligationPeriod: 'Q4 FY 2025-26', riskLevel: 'high', blockedReason: 'TRACES validation mismatch (portal exception)', priority: 'high', status: 'IN_PROGRESS' },
        { caseId: 'CASE-DEMO-0004', title: 'DIR-3 KYC', clientId: 'C001221', clientName: 'Valiant Infra LLP', assignedToXID: 'X000145', reviewerXID: 'X000081', approverXID: 'X000010', complianceState: 'filed', statutoryDueDate: plusDays(-4), internalDueDate: plusDays(-6), pendUntil: null, filedAt: plusDays(-2), obligationType: 'ROC', obligationPeriod: 'FY 2025-26', riskLevel: 'medium', blockedReason: '', priority: 'medium', status: 'FILED' },
      ],
      isDemoData: true,
    };
  }

  return {
    summary: summaryPayload,
    items: itemsPayload,
  };
};

const updateComplianceState = async ({ firmId, caseId, nextState, actorXID, blockedReason = null, pendUntil = null, filedAt = null }) => {
  const firmObjectId = new mongoose.Types.ObjectId(firmId);
  const docket = await Case.findOne({
    firmId: firmObjectId,
    $or: [{ caseId }, { caseNumber: caseId }],
  });
  if (!docket) {
    const error = new Error('Docket not found');
    error.statusCode = 404;
    throw error;
  }

  const currentState = normalizeComplianceState(docket.compliance_state) || COMPLIANCE_STATES.NOT_STARTED;
  const normalizedNextState = normalizeComplianceState(nextState);
  if (!normalizedNextState) {
    const error = new Error('Invalid compliance state');
    error.statusCode = 400;
    throw error;
  }
  if (!canComplianceTransition(currentState, normalizedNextState)) {
    const error = new Error(`Invalid transition ${currentState} -> ${normalizedNextState}`);
    error.statusCode = 400;
    throw error;
  }

  docket.compliance_state = normalizedNextState;
  docket.lastActionByXID = actorXID || docket.lastActionByXID;
  docket.lastActionAt = new Date();
  if (normalizedNextState === COMPLIANCE_STATES.BLOCKED) {
    docket.blocked_reason = blockedReason ? String(blockedReason).trim() : docket.blocked_reason;
    if (!docket.blockedAt) docket.blockedAt = new Date();
    docket.unblockedAt = null;
  } else if (currentState === COMPLIANCE_STATES.BLOCKED) {
    docket.unblockedAt = new Date();
  }
  if (normalizedNextState === COMPLIANCE_STATES.AWAITING_CLIENT && pendUntil) {
    const parsedPendUntil = new Date(pendUntil);
    if (!Number.isNaN(parsedPendUntil.getTime())) {
      docket.pend_until = parsedPendUntil;
      docket.pendingUntil = parsedPendUntil;
    }
  }
  if (normalizedNextState === COMPLIANCE_STATES.FILED) {
    const parsedFiledAt = filedAt ? new Date(filedAt) : new Date();
    docket.filed_at = Number.isNaN(parsedFiledAt.getTime()) ? new Date() : parsedFiledAt;
  }

  await docket.save();
  return docket;
};

const getApprovalQueues = async (firmId, {
  viewerXID = null,
  view = 'my_approvals',
  assigneeXID = null,
  clientId = null,
  approvalType = null,
} = {}) => {
  const firmObjectId = new mongoose.Types.ObjectId(firmId);
  const now = new Date();
  const summaryFilterBase = { firmId: firmObjectId, 'approval_stage.status': 'pending' };
  const andFilters = [];
  if (assigneeXID) andFilters.push({ assignedToXID: String(assigneeXID).trim().toUpperCase() });
  if (clientId) andFilters.push({ clientId: String(clientId).trim() });
  if (approvalType) andFilters.push({ 'approval_stage.approval_type': String(approvalType).trim().toLowerCase() });
  const composeQuery = (extra = {}) => ({
    ...summaryFilterBase,
    ...(andFilters.length ? { $and: [...andFilters, extra] } : extra),
  });

  const [myApprovals, awaitingPartner, awaitingClientSignatory, overdueApprovals] = await Promise.all([
    Case.countDocuments(composeQuery(viewerXID ? { 'approval_stage.approver': String(viewerXID).trim().toUpperCase() } : {})),
    Case.countDocuments(composeQuery({ 'approval_stage.approval_type': 'internal_partner' })),
    Case.countDocuments(composeQuery({ 'approval_stage.approval_type': { $in: ['client', 'authorised_signatory'] } })),
    Case.countDocuments(composeQuery({ 'approval_stage.due_at': { $lt: now } })),
  ]);

  const queueFilter = getApprovalQueueFilter({ view, userXID: viewerXID });
  const listQuery = {
    firmId: firmObjectId,
    ...queueFilter,
    ...(assigneeXID ? { assignedToXID: String(assigneeXID).trim().toUpperCase() } : {}),
    ...(clientId ? { clientId: String(clientId).trim() } : {}),
    ...(approvalType ? { 'approval_stage.approval_type': String(approvalType).trim().toLowerCase() } : {}),
  };
  const items = await Case.find(listQuery)
    .select('caseId caseNumber title clientId clientName assignedToXID approval_stage compliance_state statutory_due_date internal_due_date obligation_type obligation_period')
    .sort({ 'approval_stage.due_at': 1, 'approval_stage.requested_at': 1, createdAt: -1 })
    .limit(300)
    .lean();

  return {
    summary: {
      myApprovals,
      awaitingPartner,
      awaitingClientSignatory,
      overdueApprovals,
    },
    view: String(view || 'my_approvals').trim().toLowerCase(),
    items: items.map((row) => {
      const requestedAt = row?.approval_stage?.requested_at ? new Date(row.approval_stage.requested_at) : null;
      const dueAt = row?.approval_stage?.due_at ? new Date(row.approval_stage.due_at) : null;
      const ageDays = requestedAt ? Math.floor((now.getTime() - requestedAt.getTime()) / (24 * 60 * 60 * 1000)) : null;
      const overdue = Boolean(dueAt && dueAt < now);
      return {
        caseId: row.caseId || row.caseNumber,
        title: row.title || '',
        clientId: row.clientId || '',
        clientName: row.clientName || '',
        assignedToXID: row.assignedToXID || null,
        complianceState: row.compliance_state || COMPLIANCE_STATES.NOT_STARTED,
        statutoryDueDate: row.statutory_due_date || null,
        internalDueDate: row.internal_due_date || null,
        obligationType: row.obligation_type || '',
        obligationPeriod: row.obligation_period || '',
        approvalType: row?.approval_stage?.approval_type || null,
        requestedBy: row?.approval_stage?.requested_by || null,
        approver: row?.approval_stage?.approver || null,
        requestedAt: row?.approval_stage?.requested_at || null,
        dueAt: row?.approval_stage?.due_at || null,
        status: row?.approval_stage?.status || null,
        comments: row?.approval_stage?.comments || '',
        evidenceAttachmentId: row?.approval_stage?.evidence_attachment_id || null,
        ageDays,
        overdue,
      };
    }),
  };
};

const remindApproval = async ({ firmId, caseId, actorXID, escalate = false }) => sendApprovalReminderPlaceholder({
  firmId,
  caseId,
  actorXID,
  escalate,
});

module.exports = {
  getMyDockets,
  getOverdueDockets,
  getRecentDockets,
  getWorkbasketLoad,
  getRiskBrief,
  getPartnerMorningDashboard,
  getComplianceControlRoom,
  updateComplianceState,
  getApprovalQueues,
  remindApproval,
};
