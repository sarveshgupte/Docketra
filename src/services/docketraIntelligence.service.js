const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const DocketEffort = require('../models/DocketEffort.model');
const Team = require('../models/Team.model');
const User = require('../models/User.model');

const ACTIVE_DOCKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'ASSIGNED',
  'UNDER_REVIEW',
  'QC_PENDING',
  'SUBMITTED',
  'REVIEWED',
  'PENDING',
];
const ACTIVE_STATUS_SET = new Set(ACTIVE_DOCKET_STATUSES);
const TERMINAL_STATUS_SET = new Set(['RESOLVED', 'FILED', 'CLOSED', 'DELETED', 'DRAFT', 'UNASSIGNED']);
const PRIORITY_WEIGHTS = Object.freeze({
  urgent: 7,
  high: 5,
  medium: 2,
  low: 1,
});
const DEFAULT_WORKBASKET_CAPACITY_THRESHOLDS = Object.freeze({
  busy: 66,
  overloaded: 86,
});
const REVIEW_STATUS_SET = new Set(['UNDER_REVIEW', 'QC_PENDING', 'SUBMITTED', 'REVIEWED']);

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const normalizeXID = (value) => String(value || '').trim().toUpperCase();

const getFirmIdVariants = (firmId) => {
  const variants = [String(firmId)];
  if (mongoose.Types.ObjectId.isValid(String(firmId))) {
    variants.push(new mongoose.Types.ObjectId(String(firmId)));
  }
  return variants;
};

const getAvailabilityLabel = (availabilityScore) => {
  if (availabilityScore >= 75) return 'Available';
  if (availabilityScore >= 50) return 'Moderate';
  if (availabilityScore >= 25) return 'Busy';
  return 'Overloaded';
};

const normalizeCapacityThresholds = (thresholds = {}) => {
  const busy = clampScore(thresholds.busy ?? thresholds.busyThreshold ?? DEFAULT_WORKBASKET_CAPACITY_THRESHOLDS.busy);
  const overloaded = clampScore(thresholds.overloaded ?? thresholds.overloadedThreshold ?? DEFAULT_WORKBASKET_CAPACITY_THRESHOLDS.overloaded);
  if (busy >= overloaded) {
    return { ...DEFAULT_WORKBASKET_CAPACITY_THRESHOLDS };
  }
  return { busy, overloaded };
};

const getWorkbasketCapacityLabel = (capacityUtilization, thresholds = DEFAULT_WORKBASKET_CAPACITY_THRESHOLDS) => {
  const utilization = clampScore(capacityUtilization);
  if (utilization >= thresholds.overloaded) return 'Overloaded';
  if (utilization >= thresholds.busy) return 'Busy';
  return 'Healthy';
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getPrimaryDueDate = (docket = {}) => {
  const dates = [
    toDate(docket.internal_due_date),
    toDate(docket.statutory_due_date),
    toDate(docket.slaDueAt),
    toDate(docket.dueDate),
    toDate(docket?.approval_stage?.due_at),
  ].filter(Boolean);
  if (!dates.length) return null;
  return dates.sort((a, b) => a.getTime() - b.getTime())[0];
};

const isActiveDocket = (docket = {}) => {
  const status = String(docket.status || '').trim().toUpperCase();
  if (TERMINAL_STATUS_SET.has(status)) return false;
  return ACTIVE_STATUS_SET.has(status) || !status;
};

const isHighPriorityDocket = (docket = {}) => ['urgent', 'high'].includes(String(docket.priority || '').trim().toLowerCase());

const isReviewBottleneck = (docket = {}) => {
  const status = String(docket.status || '').trim().toUpperCase();
  const approvalStatus = String(docket?.approval_stage?.status || '').trim().toLowerCase();
  return REVIEW_STATUS_SET.has(status) || approvalStatus === 'pending';
};

const getDeadlineRiskLevel = ({ overdueDockets = 0, dueToday = 0, dueThisWeek = 0, highPriorityDueThisWeek = 0, reviewBottlenecks = 0 } = {}) => {
  if (overdueDockets >= 10 || (overdueDockets >= 5 && reviewBottlenecks >= 5) || highPriorityDueThisWeek >= 8) return 'Critical';
  if (overdueDockets > 0 || dueToday >= 5 || highPriorityDueThisWeek >= 3 || reviewBottlenecks >= 5) return 'High Risk';
  if (dueToday > 0 || dueThisWeek > 0 || highPriorityDueThisWeek > 0 || reviewBottlenecks > 0) return 'Medium Risk';
  return 'Low Risk';
};

const getDeadlineRecommendation = (riskLevel, counts = {}) => {
  if (riskLevel === 'Critical') return 'Reassign work immediately.';
  if (riskLevel === 'High Risk') {
    if ((counts.reviewBottlenecks || 0) >= 5) return 'Clear review approvals before assigning new deadline work.';
    return 'Rebalance overdue and due-today work across available assignees.';
  }
  if (riskLevel === 'Medium Risk') return 'Monitor due work and prioritize high-priority deadlines this week.';
  return 'No immediate action required.';
};

const mapAffectedDocket = (docket = {}) => ({
  caseId: docket.caseId || docket.caseNumber || docket.caseInternalId || String(docket._id || ''),
  title: docket.title || docket.caseName || docket.caseTitle || null,
  priority: docket.priority || null,
  status: docket.status || null,
  dueDate: getPrimaryDueDate(docket),
  assigneeXID: docket.assignedToXID || null,
  workbasketId: docket.workbasketId || docket.ownerTeamId || docket.routedToTeamId || null,
});

const createEmptyMetrics = (member) => ({
  userId: member._id ? String(member._id) : null,
  xID: normalizeXID(member.xID || member.xid),
  name: member.name || member.email || normalizeXID(member.xID || member.xid),
  email: member.email || null,
  role: member.role || null,
  metrics: {
    openDockets: 0,
    urgentPriorityDockets: 0,
    highPriorityDockets: 0,
    dueThisWeek: 0,
    dueToday: 0,
    overdue: 0,
    reviewWorkload: 0,
    estimatedHours: 0,
    actualHours: 0,
    overrunHours: 0,
  },
  scoreSignals: {
    openDocketPressure: 0,
    priorityPressure: 0,
    dueDatePressure: 0,
    reviewPressure: 0,
    estimatedHoursPressure: 0,
    actualHoursPressure: 0,
    overrunPressure: 0,
  },
});

const applyAssignedDocket = (entry, docket, now) => {
  const priority = String(docket.priority || 'medium').toLowerCase();
  const dueDate = getPrimaryDueDate(docket);
  const expectedMinutes = Math.max(Number(docket.expectedMinutes) || 0, 0);
  const diffMs = dueDate ? dueDate.getTime() - now.getTime() : null;
  const dueInDays = diffMs == null ? null : Math.floor(diffMs / (24 * 60 * 60 * 1000));

  entry.metrics.openDockets += 1;
  entry.metrics.estimatedHours += expectedMinutes / 60;
  entry.scoreSignals.openDocketPressure += 3;
  entry.scoreSignals.priorityPressure += PRIORITY_WEIGHTS[priority] || 2;
  entry.scoreSignals.estimatedHoursPressure += (expectedMinutes / 60) * 1.25;

  if (priority === 'urgent') entry.metrics.urgentPriorityDockets += 1;
  if (priority === 'high') entry.metrics.highPriorityDockets += 1;

  if (dueInDays != null && dueInDays < 0) {
    entry.metrics.overdue += 1;
    entry.scoreSignals.dueDatePressure += 10;
  } else if (dueInDays != null && dueInDays <= 1) {
    entry.metrics.dueToday += 1;
    entry.scoreSignals.dueDatePressure += 8;
  } else if (dueInDays != null && dueInDays <= 7) {
    entry.metrics.dueThisWeek += 1;
    entry.scoreSignals.dueDatePressure += 4;
  }
};

const applyReviewDocket = (entry, docket, now) => {
  entry.metrics.reviewWorkload += 1;
  entry.scoreSignals.reviewPressure += 6;

  const approvalDueAt = toDate(docket?.approval_stage?.due_at);
  if (approvalDueAt && approvalDueAt.getTime() < now.getTime()) {
    entry.metrics.overdue += 1;
    entry.scoreSignals.dueDatePressure += 8;
  }
};

const scoreMember = (entry) => {
  const actualHours = entry.metrics.actualHours;
  const estimatedHours = entry.metrics.estimatedHours;
  entry.metrics.estimatedHours = Number(estimatedHours.toFixed(2));
  entry.metrics.actualHours = Number(actualHours.toFixed(2));
  entry.metrics.overrunHours = Number(Math.max(actualHours - estimatedHours, 0).toFixed(2));

  entry.scoreSignals.actualHoursPressure = actualHours * 0.75;
  entry.scoreSignals.overrunPressure = entry.metrics.overrunHours * 2;

  Object.keys(entry.scoreSignals).forEach((key) => {
    entry.scoreSignals[key] = Number(entry.scoreSignals[key].toFixed(2));
  });

  const workloadScore = clampScore(Object.values(entry.scoreSignals).reduce((sum, value) => sum + value, 0));
  const availabilityScore = clampScore(100 - workloadScore);

  return {
    ...entry,
    workloadScore,
    availabilityScore,
    availabilityLabel: getAvailabilityLabel(availabilityScore),
  };
};

const getWorkbasketIdVariants = (workbasketId) => {
  const variants = [String(workbasketId)];
  if (mongoose.Types.ObjectId.isValid(String(workbasketId))) {
    variants.push(new mongoose.Types.ObjectId(String(workbasketId)));
  }
  return variants;
};

const buildWorkbasketDocketQuery = ({ firmIdVariants, workbasketId }) => {
  const workbasketIdVariants = getWorkbasketIdVariants(workbasketId);
  return {
    firmId: { $in: firmIdVariants },
    $or: [
      { workbasketId: { $in: workbasketIdVariants } },
      { ownerTeamId: { $in: workbasketIdVariants } },
      { routedToTeamId: { $in: workbasketIdVariants } },
    ],
  };
};

async function getWorkloadIntelligence({ firmId, workbasketId = null, candidateXIDs = null, workType = null, clientId = null } = {}) {
  if (!firmId) {
    throw new Error('firmId is required');
  }

  const firmIdVariants = getFirmIdVariants(firmId);
  const normalizedCandidates = Array.isArray(candidateXIDs)
    ? candidateXIDs.map(normalizeXID).filter(Boolean)
    : null;

  const userQuery = {
    firmId: { $in: firmIdVariants },
    status: { $ne: 'deleted' },
    isActive: { $ne: false },
    role: { $in: ['USER', 'MANAGER', 'ADMIN', 'PRIMARY_ADMIN'] },
    ...(normalizedCandidates?.length ? { xID: { $in: normalizedCandidates } } : {}),
  };

  if (workbasketId) {
    userQuery.$or = [
      { teamId: workbasketId },
      { teamIds: workbasketId },
      ...(mongoose.Types.ObjectId.isValid(String(workbasketId)) ? [
        { teamId: new mongoose.Types.ObjectId(String(workbasketId)) },
        { teamIds: new mongoose.Types.ObjectId(String(workbasketId)) },
      ] : []),
    ];
  }

  const members = await User.find(userQuery)
    .select('_id xID xid name email role teamId teamIds')
    .sort({ name: 1, xID: 1 })
    .lean();

  const memberMap = new Map();
  members.forEach((member) => {
    const xID = normalizeXID(member.xID || member.xid);
    if (xID) memberMap.set(xID, createEmptyMetrics({ ...member, xID }));
  });

  if (!memberMap.size) {
    return {
      generatedAt: new Date().toISOString(),
      summary: { totalMembers: 0, available: 0, moderate: 0, busy: 0, overloaded: 0 },
      recommendations: buildWorkloadRecommendations([]),
      members: [],
    };
  }

  const memberXIDs = [...memberMap.keys()];
  const now = new Date();

  const dockets = await Case.find({
    firmId: { $in: firmIdVariants },
    $or: [
      { assignedToXID: { $in: memberXIDs } },
      { reviewer_xid: { $in: memberXIDs } },
      { 'approval_stage.approver': { $in: memberXIDs }, 'approval_stage.status': 'pending' },
    ],
  })
    .select('caseInternalId caseId caseNumber title status priority dueDate slaDueAt internal_due_date statutory_due_date expectedMinutes assignedToXID reviewer_xid approval_stage')
    .lean();

  const activeDockets = dockets.filter(isActiveDocket);
  const activeCaseInternalIds = activeDockets.map((docket) => docket.caseInternalId).filter(Boolean);

  const effortRows = activeCaseInternalIds.length
    ? await DocketEffort.aggregate([
      {
        $match: {
          userXID: { $in: memberXIDs },
          caseInternalId: { $in: activeCaseInternalIds },
          $or: [
            { tenantId: String(firmId) },
            ...(mongoose.Types.ObjectId.isValid(String(firmId)) ? [{ firmId: new mongoose.Types.ObjectId(String(firmId)) }] : []),
          ],
        },
      },
      { $group: { _id: '$userXID', minutes: { $sum: '$minutes' } } },
    ])
    : [];

  effortRows.forEach((row) => {
    const entry = memberMap.get(normalizeXID(row._id));
    if (entry) {
      entry.metrics.actualHours = Math.max(Number(row.minutes) || 0, 0) / 60;
    }
  });

  activeDockets.forEach((docket) => {
    const assigneeXID = normalizeXID(docket.assignedToXID);
    const assigneeEntry = memberMap.get(assigneeXID);
    if (assigneeEntry) {
      applyAssignedDocket(assigneeEntry, docket, now);
    }

    const reviewerXID = normalizeXID(docket.reviewer_xid);
    const reviewerEntry = memberMap.get(reviewerXID);
    if (reviewerEntry) {
      applyReviewDocket(reviewerEntry, docket, now);
    }

    const approverXID = normalizeXID(docket?.approval_stage?.approver);
    const isPendingApproval = String(docket?.approval_stage?.status || '').toLowerCase() === 'pending';
    const approverEntry = isPendingApproval ? memberMap.get(approverXID) : null;
    if (approverEntry && approverXID !== reviewerXID) {
      applyReviewDocket(approverEntry, docket, now);
    }
  });

  const scoredMembers = [...memberMap.values()].map(scoreMember).sort((a, b) =>
    (b.availabilityScore - a.availabilityScore) || String(a.name || '').localeCompare(String(a.name || ''))
  );

  // Compute Work Type Expertise and Client Affinity for candidates
  const targetWorkType = String(workType || '').trim();
  const targetClientId = String(clientId || '').trim();

  let expertiseMap = new Map();
  let affinityMap = new Map();

  // ⚡ Bolt Performance Optimization:
  // 💡 What: Replaced sequential database queries with concurrent Promise.all() execution.
  // 🎯 Why: This halves the database latency for expertise and affinity lookup by running independent aggregations simultaneously.
  let expertisePromise = Promise.resolve([]);
  if (targetWorkType) {
    const rx = new RegExp(targetWorkType.replace(/[.*+?^\$\{\}()\[\]\\]/g, '\\$&'), 'i');
    expertisePromise = Case.aggregate([
      {
        $match: {
          $or: [
            { firmId: { $in: firmIdVariants } },
            { firmId: String(firmId) },
          ],
          status: { $in: ['RESOLVED', 'CLOSED', 'FILED', 'Done', 'DONE'] },
          $or: [
            { workType: rx },
            { title: rx },
            { subcategory: rx },
            { subcategoryId: rx },
          ],
        },
      },
      { $group: { _id: '$assignedToXID', count: { $sum: 1 } } },
    ]);
  }

  let affinityPromise = Promise.resolve([]);
  if (targetClientId) {
    affinityPromise = Case.aggregate([
      {
        $match: {
          $or: [
            { firmId: { $in: firmIdVariants } },
            { firmId: String(firmId) },
          ],
          clientId: targetClientId,
        },
      },
      { $group: { _id: '$assignedToXID', count: { $sum: 1 } } },
    ]);
  }

  const [expertiseRows, affinityRows] = await Promise.all([expertisePromise, affinityPromise]);

  expertiseRows.forEach((r) => {
    if (r._id) expertiseMap.set(normalizeXID(r._id), r.count);
  });
  affinityRows.forEach((r) => {
    if (r._id) affinityMap.set(normalizeXID(r._id), r.count);
  });

  // Calculate Capacity-Balanced Match Score for each member
  scoredMembers.forEach((member) => {
    const resolvedCount = expertiseMap.get(member.xID) || 0;
    const clientHistoryCount = affinityMap.get(member.xID) || 0;

    // Expertise score 0-100 based on resolved count (max out at 20 dockets = 100 score)
    const expertiseScore = clampScore(Math.min(resolvedCount * 5, 100));
    const affinityScore = clampScore(Math.min(clientHistoryCount * 20, 100));

    // Capacity-Balanced Match Formula: Expertise * (Availability / 100)
    // Suppress overloaded/busy members from getting high match scores
    const capacityFactor = member.availabilityScore / 100;
    const balancedMatchScore = clampScore(
      (expertiseScore * 0.6 + affinityScore * 0.4 + member.availabilityScore * 0.2) * capacityFactor
    );

    member.intelligenceMatch = {
      expertiseScore,
      resolvedCount,
      affinityScore,
      clientHistoryCount,
      balancedMatchScore,
    };
  });

  const summary = scoredMembers.reduce((acc, member) => {
    acc.totalMembers += 1;
    const key = member.availabilityLabel.toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { totalMembers: 0, available: 0, moderate: 0, busy: 0, overloaded: 0 });

  return {
    generatedAt: new Date().toISOString(),
    summary,
    recommendations: buildWorkloadRecommendations(scoredMembers),
    members: scoredMembers,
  };
}

const buildWorkloadRecommendations = (members = []) => {
  const ranked = [...members].sort((a, b) =>
    ((b.intelligenceMatch?.balancedMatchScore || b.availabilityScore) - (a.intelligenceMatch?.balancedMatchScore || a.availabilityScore)) ||
    (b.availabilityScore - a.availabilityScore) ||
    (a.metrics.overdue - b.metrics.overdue) ||
    String(a.name || '').localeCompare(String(b.name || ''))
  );

  // Filter out Overloaded members (Availability < 25)
  const bestAssignees = ranked
    .filter((member) => member.availabilityScore >= 50)
    .slice(0, 3)
    .map((member) => ({
      xID: member.xID,
      name: member.name,
      availabilityScore: member.availabilityScore,
      availabilityLabel: member.availabilityLabel,
      openDockets: member.metrics.openDockets,
      overdue: member.metrics.overdue,
      expertiseScore: member.intelligenceMatch?.expertiseScore || 0,
      resolvedCount: member.intelligenceMatch?.resolvedCount || 0,
      balancedMatchScore: member.intelligenceMatch?.balancedMatchScore || member.availabilityScore,
    }));

  // Identify Overloaded Expert Mentors (High expertise BUT overloaded)
  const mentorSuggestions = members
    .filter((m) => m.availabilityScore < 50 && (m.intelligenceMatch?.expertiseScore || 0) >= 50)
    .slice(0, 2)
    .map((m) => ({
      xID: m.xID,
      name: m.name,
      expertiseScore: m.intelligenceMatch?.expertiseScore,
      reason: `Senior expert in this work type (${m.intelligenceMatch?.resolvedCount} dockets completed). Paired as Senior Mentor to avoid execution overload.`,
    }));

  const avoidAssigning = ranked
    .filter((member) => member.availabilityLabel === 'Overloaded' || (member.availabilityLabel === 'Busy' && member.metrics.overdue > 0))
    .slice(0, 3)
    .map((member) => ({
      xID: member.xID,
      name: member.name,
      availabilityScore: member.availabilityScore,
      availabilityLabel: member.availabilityLabel,
      reason: member.availabilityLabel === 'Overloaded'
        ? 'Overloaded with active work (New assignments suppressed to prevent burnout)'
        : `${member.metrics.overdue} overdue docket(s) require attention`,
    }));

  return {
    recommendedAssignee: bestAssignees[0] || null,
    bestAssignees,
    avoidAssigning,
    mentorSuggestions,
    explanation: 'Recommendations rank Capacity-Balanced Expertise first (Expertise x Availability), excluding overloaded team members.',
  };
};

async function getWorkbasketCapacityIntelligence({
  firmId,
  thresholds = {},
  includeQc = false,
} = {}) {
  if (!firmId) {
    throw new Error('firmId is required');
  }

  const firmIdVariants = getFirmIdVariants(firmId);
  const normalizedThresholds = normalizeCapacityThresholds(thresholds);

  const workbaskets = await Team.find({
    firmId: { $in: firmIdVariants },
    isActive: { $ne: false },
    ...(includeQc ? {} : { type: 'PRIMARY', parentWorkbasketId: null }),
  })
    .select('_id name type parentWorkbasketId')
    .sort({ name: 1 })
    .lean();

  const now = new Date();
  const rows = await Promise.all(workbaskets.map(async (workbasket) => {
    const workbasketId = String(workbasket._id);
    const [workload, dockets] = await Promise.all([
      getWorkloadIntelligence({ firmId, workbasketId }),
      Case.find(buildWorkbasketDocketQuery({ firmIdVariants, workbasketId }))
        .select('caseInternalId status dueDate slaDueAt internal_due_date statutory_due_date expectedMinutes')
        .lean(),
    ]);

    const activeDockets = dockets.filter(isActiveDocket);
    const activeCaseInternalIds = activeDockets.map((docket) => docket.caseInternalId).filter(Boolean);
    const effortRows = activeCaseInternalIds.length
      ? await DocketEffort.aggregate([
        {
          $match: {
            caseInternalId: { $in: activeCaseInternalIds },
            $or: [
              { tenantId: String(firmId) },
              ...(mongoose.Types.ObjectId.isValid(String(firmId)) ? [{ firmId: new mongoose.Types.ObjectId(String(firmId)) }] : []),
            ],
          },
        },
        { $group: { _id: null, minutes: { $sum: '$minutes' } } },
      ])
      : [];

    const memberCount = workload.members.length;
    const averageAvailabilityScore = memberCount
      ? clampScore(workload.members.reduce((sum, member) => sum + (Number(member.availabilityScore) || 0), 0) / memberCount)
      : 0;
    const openDockets = activeDockets.length;
    const overdueDockets = activeDockets.filter((docket) => {
      const dueDate = getPrimaryDueDate(docket);
      return dueDate && dueDate.getTime() < now.getTime();
    }).length;
    const totalEstimatedHours = Number(activeDockets.reduce((sum, docket) => sum + (Math.max(Number(docket.expectedMinutes) || 0, 0) / 60), 0).toFixed(2));
    const totalActualHours = Number(((Number(effortRows?.[0]?.minutes) || 0) / 60).toFixed(2));
    const capacityUtilization = memberCount ? clampScore(100 - averageAvailabilityScore) : (openDockets > 0 ? 100 : 0);
    const capacityLabel = getWorkbasketCapacityLabel(capacityUtilization, normalizedThresholds);

    return {
      workbasketId,
      name: workbasket.name || 'Unnamed Workbasket',
      type: workbasket.type || 'PRIMARY',
      memberCount,
      openDockets,
      overdueDockets,
      totalEstimatedHours,
      totalActualHours,
      averageAvailabilityScore,
      capacityUtilization,
      capacityLabel,
      thresholds: normalizedThresholds,
    };
  }));

  const sortedWorkbaskets = rows.sort((left, right) =>
    (right.capacityUtilization - left.capacityUtilization) ||
    (right.overdueDockets - left.overdueDockets) ||
    String(left.name || '').localeCompare(String(right.name || ''))
  );

  const summary = sortedWorkbaskets.reduce((acc, workbasket) => {
    acc.totalWorkbaskets += 1;
    const key = String(workbasket.capacityLabel || '').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { totalWorkbaskets: 0, healthy: 0, busy: 0, overloaded: 0 });

  return {
    generatedAt: new Date().toISOString(),
    thresholds: normalizedThresholds,
    summary,
    workbaskets: sortedWorkbaskets,
  };
}

async function getDeadlineRiskIntelligence({ firmId } = {}) {
  if (!firmId) {
    throw new Error('firmId is required');
  }

  const firmIdVariants = getFirmIdVariants(firmId);
  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 7);

  const dockets = await Case.find({ firmId: { $in: firmIdVariants } })
    .select('_id caseInternalId caseId caseNumber title caseName status lifecycle pendingReason reopenAt workType priority dueDate slaDueAt internal_due_date statutory_due_date assignedToXID workbasketId ownerTeamId routedToTeamId reviewer_xid approval_stage expectedMinutes')
    .lean();

  const activeDockets = dockets.filter(isActiveDocket);
  const affectedMap = new Map();
  const addAffected = (docket) => {
    const mapped = mapAffectedDocket(docket);
    if (mapped.caseId) affectedMap.set(String(mapped.caseId), mapped);
  };

  // Calculate 10-State Lifecycle Bottlenecks & Predictive SLA Breaches
  let pendStagnationCount = 0;
  let qcBottleneckCount = 0;
  let routedFrictionCount = 0;
  let predictiveBreachCount = 0;

  const now = new Date();

  // Average historical effort per workType
  const historicalEffortRows = await DocketEffort.aggregate([
    {
      $match: {
        $or: [
          { tenantId: String(firmId) },
          ...(mongoose.Types.ObjectId.isValid(String(firmId)) ? [{ firmId: new mongoose.Types.ObjectId(String(firmId)) }] : []),
        ],
      },
    },
    { $group: { _id: '$workType', avgMinutes: { $avg: '$minutes' } } },
  ]);
  const avgEffortMap = new Map();
  historicalEffortRows.forEach((r) => {
    if (r._id) avgEffortMap.set(String(r._id).trim(), Math.max(Number(r.avgMinutes) || 120, 60));
  });

  const counts = activeDockets.reduce((acc, docket) => {
    const dueDate = getPrimaryDueDate(docket);
    const status = String(docket.status || '').toUpperCase();
    const lifecycle = String(docket.lifecycle || '').toUpperCase();

    // 10-State Lifecycle Radar
    if (status === 'PENDING' || status === 'PEND' || lifecycle === 'WAITING') {
      const pendedMs = docket.reopenAt ? new Date(docket.reopenAt).getTime() - now.getTime() : null;
      if (pendedMs == null || pendedMs <= 0 || pendedMs < 5 * 24 * 60 * 60 * 1000) {
        pendStagnationCount += 1;
      }
    }

    if (status === 'QC_PENDING' || status === 'QC_WB' || status === 'QC_ASSIGNED') {
      qcBottleneckCount += 1;
    }

    if (status === 'ROUTED' || status === 'ROUTED_ASSIGNED') {
      routedFrictionCount += 1;
    }

    // Predictive SLA Breach Engine: remaining hours < avg historical effort hours
    if (dueDate && dueDate.getTime() > now.getTime()) {
      const remainingHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      const avgEffortHours = (avgEffortMap.get(docket.workType) || 180) / 60;
      if (remainingHours < avgEffortHours) {
        predictiveBreachCount += 1;
        addAffected(docket);
      }
    }

    if (dueDate) {
      if (dueDate.getTime() < todayStart.getTime()) {
        acc.overdueDockets += 1;
        addAffected(docket);
      } else if (dueDate.getTime() >= todayStart.getTime() && dueDate.getTime() < tomorrowStart.getTime()) {
        acc.dueToday += 1;
        acc.dueThisWeek += 1;
        if (isHighPriorityDocket(docket)) acc.highPriorityDueThisWeek += 1;
        addAffected(docket);
      } else if (dueDate.getTime() < weekEnd.getTime()) {
        acc.dueThisWeek += 1;
        if (isHighPriorityDocket(docket)) acc.highPriorityDueThisWeek += 1;
        addAffected(docket);
      }
    }

    if (isReviewBottleneck(docket)) {
      acc.reviewBottlenecks += 1;
      addAffected(docket);
    }

    return acc;
  }, {
    overdueDockets: 0,
    dueToday: 0,
    dueThisWeek: 0,
    highPriorityDueThisWeek: 0,
    reviewBottlenecks: 0,
  });

  counts.pendStagnation = pendStagnationCount;
  counts.qcBottlenecks = qcBottleneckCount;
  counts.routedFriction = routedFrictionCount;
  counts.predictiveSlaBreaches = predictiveBreachCount;

  const riskLevel = getDeadlineRiskLevel(counts);
  const recommendedAction = getDeadlineRecommendation(riskLevel, counts);
  const affectedDockets = [...affectedMap.values()].sort((left, right) => {
    const leftDate = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate || String(left.caseId || '').localeCompare(String(right.caseId || ''));
  });

  return {
    generatedAt: new Date().toISOString(),
    riskLevel,
    recommendedAction,
    affectedDocketCount: affectedDockets.length,
    counts,
    affectedDockets,
    radar: [
      { label: 'Overdue Dockets', value: counts.overdueDockets },
      { label: 'Due Today', value: counts.dueToday },
      { label: 'Predictive SLA Breaches', value: counts.predictiveSlaBreaches },
      { label: 'PEND Stagnation', value: counts.pendStagnation },
      { label: 'QC Bottlenecks', value: counts.qcBottlenecks },
    ],
  };
}

async function getClientComplianceRiskScores({ firmId } = {}) {
  if (!firmId) throw new Error('firmId is required');
  const firmIdVariants = getFirmIdVariants(firmId);

  const dockets = await Case.find({ firmId: { $in: firmIdVariants } })
    .select('clientId caseId status reopenAt createdAt statutory_due_date')
    .lean();

  const clientMap = new Map();
  dockets.forEach((d) => {
    if (!d.clientId) return;
    if (!clientMap.has(d.clientId)) {
      clientMap.set(d.clientId, { clientId: d.clientId, totalDockets: 0, pendedCount: 0, overdueCount: 0 });
    }
    const entry = clientMap.get(d.clientId);
    entry.totalDockets += 1;
    if (d.status === 'PENDING' || d.status === 'PEND') entry.pendedCount += 1;
    if (d.statutory_due_date && new Date(d.statutory_due_date).getTime() < Date.now() && d.status !== 'RESOLVED') {
      entry.overdueCount += 1;
    }
  });

  const clients = [...clientMap.values()].map((entry) => {
    const pendedRatio = entry.totalDockets ? entry.pendedCount / entry.totalDockets : 0;
    let riskRating = 'Responsive';
    if (pendedRatio > 0.4 || entry.overdueCount >= 3) riskRating = 'High Risk';
    else if (pendedRatio > 0.2 || entry.overdueCount >= 1) riskRating = 'Sluggish';
    else if (pendedRatio > 0.1) riskRating = 'Moderate';

    return {
      ...entry,
      pendedRatio: Number((pendedRatio * 100).toFixed(1)),
      riskRating,
    };
  }).sort((a, b) => b.pendedRatio - a.pendedRatio);

  return { generatedAt: new Date().toISOString(), clients };
}

async function generateExecutiveAiBrief({ firmId } = {}) {
  if (!firmId) throw new Error('firmId is required');

  const [workload, deadlineRisk] = await Promise.all([
    getWorkloadIntelligence({ firmId }),
    getDeadlineRiskIntelligence({ firmId }),
  ]);

  const summary = workload.summary || {};
  const counts = deadlineRisk.counts || {};
  const best = workload.recommendations?.bestAssignees?.[0]?.name || 'Available team members';

  const line1 = counts.overdueDockets > 0
    ? `⚠️ Operational Warning: ${counts.overdueDockets} docket(s) are overdue and ${counts.predictiveSlaBreaches} at predictive SLA breach risk.`
    : `✅ Operational Status: All statutory filing deadlines are currently on schedule.`;

  const line2 = summary.overloaded > 0
    ? `Capacity Alert: ${summary.overloaded} team member(s) are overloaded. Recommended to rebalance work to ${best}.`
    : `Capacity Status: Team workload is balanced with ${summary.available} available member(s).`;

  const line3 = counts.qcBottlenecks > 0
    ? `Review Bottleneck: ${counts.qcBottlenecks} docket(s) are awaiting QC verification in the queue.`
    : `Workflow Flow: No review bottlenecks detected.`;

  return {
    executiveBrief: `${line1} ${line2} ${line3}`,
    generatedAt: new Date().toISOString(),
  };
}

async function rebalanceWorkload({ firmId, execute = false } = {}) {
  if (!firmId) throw new Error('firmId is required');

  const workload = await getWorkloadIntelligence({ firmId });
  const overloadedMembers = workload.members.filter((m) => m.availabilityLabel === 'Overloaded');
  const availableMembers = workload.members.filter((m) => m.availabilityLabel === 'Available');

  if (!overloadedMembers.length || !availableMembers.length) {
    return {
      rebalancedCount: 0,
      message: 'No rebalancing needed. Workload is already balanced across available members.',
      reassignedDockets: [],
    };
  }

  const overloadedXIDs = overloadedMembers.map((m) => m.xID);
  const firmIdVariants = getFirmIdVariants(firmId);

  // Find unstarted dockets assigned to overloaded members
  const candidateDockets = await Case.find({
    firmId: { $in: firmIdVariants },
    assignedToXID: { $in: overloadedXIDs },
    status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
  }).select('_id caseId title workType assignedToXID').lean();

  const reassignedDockets = [];
  let availableIdx = 0;

  for (const docket of candidateDockets) {
    const targetMember = availableMembers[availableIdx % availableMembers.length];
    reassignedDockets.push({
      caseId: docket.caseId,
      title: docket.title,
      fromXID: docket.assignedToXID,
      toXID: targetMember.xID,
      toName: targetMember.name,
    });

    if (execute) {
      await Case.updateOne(
        { _id: docket._id },
        { $set: { assignedToXID: targetMember.xID, assignedTo: targetMember.name } }
      );
    }
    availableIdx += 1;
  }

  return {
    rebalancedCount: reassignedDockets.length,
    execute,
    message: execute
      ? `Successfully reassigned ${reassignedDockets.length} docket(s) to available team members.`
      : `Identified ${reassignedDockets.length} docket(s) ready for smart rebalancing.`,
    reassignedDockets,
  };
}

module.exports = {
  getWorkloadIntelligence,
  getWorkbasketCapacityIntelligence,
  getDeadlineRiskIntelligence,
  getClientComplianceRiskScores,
  generateExecutiveAiBrief,
  rebalanceWorkload,
  buildWorkloadRecommendations,
  getAvailabilityLabel,
  getWorkbasketCapacityLabel,
  getDeadlineRiskLevel,
  normalizeCapacityThresholds,
  normalizeXID,
};
