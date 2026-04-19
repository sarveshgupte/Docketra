const mongoose = require('mongoose');
const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Team = require('../models/Team.model');
const Case = require('../models/Case.model');
const { OnboardingEvent, ONBOARDING_EVENT_NAMES } = require('../models/OnboardingEvent.model');
const { normalizeRole } = require('../utils/role.utils');

const EVENT_SET = new Set(ONBOARDING_EVENT_NAMES);

const normalizeStepId = (value) => {
  if (!value) return null;
  return String(value).trim().slice(0, 120) || null;
};

const normalizeSource = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'manual' || normalized === 'detected' ? normalized : null;
};

const toSortedIds = (steps = [], completed = true) => steps
  .filter((step) => Boolean(step?.completed) === completed)
  .map((step) => normalizeStepId(step.id))
  .filter(Boolean)
  .sort();

const arraysEqual = (left = [], right = []) => {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
};

const buildBaseEvent = ({ user, firmId, role }) => ({
  userId: user._id,
  userXID: String(user.xID || user.xid || '').toUpperCase(),
  firmId,
  role: normalizeRole(role || user.role) || 'USER',
});

const createEvent = async ({ user, firmId, role, eventName, stepId = null, source = null, metadata = undefined }) => {
  if (!user?._id || !firmId || !EVENT_SET.has(eventName)) return null;

  const payload = {
    ...buildBaseEvent({ user, firmId, role }),
    eventName,
    stepId: normalizeStepId(stepId),
    source: normalizeSource(source),
  };

  if (metadata && typeof metadata === 'object') {
    payload.metadata = metadata;
  }

  return OnboardingEvent.create(payload);
};

const recordProgressIfChanged = async ({ user, firmId, role, steps = [] }) => {
  if (!user?._id || !firmId) return { changed: false };

  const completedStepIds = toSortedIds(steps, true);
  const incompleteStepIds = toSortedIds(steps, false);
  const completed = completedStepIds.length;
  const total = steps.length;

  const latestUser = await User.findById(user._id)
    .select('onboardingTelemetry role xID xid firmId')
    .lean();

  const previous = latestUser?.onboardingTelemetry || {};
  const prevCompletedIds = Array.isArray(previous.lastCompletedStepIds) ? previous.lastCompletedStepIds : [];
  const prevIncompleteIds = Array.isArray(previous.lastIncompleteStepIds) ? previous.lastIncompleteStepIds : [];

  const progressChanged =
    !arraysEqual(prevCompletedIds, completedStepIds)
    || !arraysEqual(prevIncompleteIds, incompleteStepIds)
    || Number(previous.lastProgressCompleted || 0) !== completed
    || Number(previous.lastProgressTotal || 0) !== total
    || String(previous.lastProgressRole || '') !== String(normalizeRole(role || user.role) || 'USER');

  if (!progressChanged) {
    return { changed: false };
  }

  const now = new Date();

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        'onboardingTelemetry.lastProgressRefreshedAt': now,
        'onboardingTelemetry.lastProgressRole': normalizeRole(role || user.role) || 'USER',
        'onboardingTelemetry.lastCompletedStepIds': completedStepIds,
        'onboardingTelemetry.lastIncompleteStepIds': incompleteStepIds,
        'onboardingTelemetry.lastProgressCompleted': completed,
        'onboardingTelemetry.lastProgressTotal': total,
      },
    },
  );

  await createEvent({
    user,
    firmId,
    role,
    eventName: 'onboarding_progress_refreshed',
    metadata: { completed, total },
  });

  const newlyCompleted = completedStepIds.filter((id) => !prevCompletedIds.includes(id));
  if (newlyCompleted.length) {
    await Promise.all(newlyCompleted.map((stepId) => createEvent({
      user,
      firmId,
      role,
      eventName: 'onboarding_step_completed_detected',
      stepId,
      source: 'detected',
    })));
  }

  return { changed: true, completed, total, newlyCompleted };
};

const getOnboardingInsights = async ({ sinceDays = 30, recentLimit = 25, staleAfterDays = 3 } = {}) => {
  const now = new Date();
  const since = new Date(now.getTime() - (Number(sinceDays) * 24 * 60 * 60 * 1000));
  const staleThreshold = new Date(now.getTime() - (Number(staleAfterDays) * 24 * 60 * 60 * 1000));

  const [
    totalFirms,
    usersByCompletion,
    incompleteByRole,
    tutorialEvents,
    blockerEvents,
    recentEvents,
    firmsWithActiveClients,
    firmIdsWithCategories,
    firmIdsWithWorkbaskets,
    managerIdsWithQueues,
    usersWithAssignedDockets,
    skippedStillIncomplete,
  ] = await Promise.all([
    Firm.countDocuments({ status: { $ne: 'deleted' } }),
    User.aggregate([
      { $match: { role: { $in: ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'] }, status: { $ne: 'deleted' } } },
      {
        $project: {
          role: 1,
          completed: {
            $gte: [
              { $ifNull: ['$onboardingTelemetry.lastProgressCompleted', 0] },
              { $ifNull: ['$onboardingTelemetry.lastProgressTotal', 0] },
            ],
          },
          hasProgress: { $gt: [{ $ifNull: ['$onboardingTelemetry.lastProgressTotal', 0] }, 0] },
        },
      },
      {
        $group: {
          _id: '$role',
          completedUsers: { $sum: { $cond: [{ $and: ['$hasProgress', '$completed'] }, 1, 0] } },
          incompleteUsers: { $sum: { $cond: [{ $and: ['$hasProgress', { $not: '$completed' }] }, 1, 0] } },
          noProgressYet: { $sum: { $cond: [{ $not: '$hasProgress' }, 1, 0] } },
          totalUsers: { $sum: 1 },
        },
      },
    ]),
    OnboardingEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          eventName: { $in: ['onboarding_step_completed_detected', 'onboarding_step_completed_manual'] },
          role: { $in: ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'] },
          stepId: { $ne: null },
        },
      },
      {
        $group: {
          _id: { role: '$role', stepId: '$stepId', eventName: '$eventName' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 60 },
    ]),
    OnboardingEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          eventName: { $in: ['welcome_tutorial_completed', 'welcome_tutorial_skipped'] },
        },
      },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
    ]),
    User.aggregate([
      {
        $match: {
          role: { $in: ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'] },
          status: { $ne: 'deleted' },
          'onboardingTelemetry.lastProgressTotal': { $gt: 0 },
        },
      },
      {
        $project: {
          firmId: 1,
          role: 1,
          incompleteStepIds: { $ifNull: ['$onboardingTelemetry.lastIncompleteStepIds', []] },
        },
      },
      { $unwind: '$incompleteStepIds' },
      {
        $group: {
          _id: { role: '$role', stepId: '$incompleteStepIds' },
          users: { $sum: 1 },
          firms: { $addToSet: '$firmId' },
        },
      },
      {
        $project: {
          _id: 0,
          role: '$_id.role',
          stepId: '$_id.stepId',
          users: 1,
          firms: { $size: '$firms' },
        },
      },
      { $sort: { users: -1 } },
      { $limit: 25 },
    ]),
    OnboardingEvent.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(Number(recentLimit) || 25, 1), 100))
      .select('eventName role stepId source userXID firmId createdAt metadata')
      .lean(),
    Client.distinct('firmId', { status: 'active', isActive: { $ne: false } }),
    Category.distinct('firmId', { isActive: { $ne: false } }),
    Team.distinct('firmId', { isActive: { $ne: false }, type: 'PRIMARY' }),
    Team.distinct('managerId', { isActive: { $ne: false }, type: 'PRIMARY' }),
    Case.distinct('assignedToXID', { assignedToXID: { $nin: [null, ''] } }),
    User.countDocuments({
      role: { $in: ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'] },
      status: { $ne: 'deleted' },
      'tutorialState.skippedAt': { $lte: staleThreshold },
      'onboardingTelemetry.lastProgressTotal': { $gt: 0 },
      $expr: { $lt: ['$onboardingTelemetry.lastProgressCompleted', '$onboardingTelemetry.lastProgressTotal'] },
    }),
  ]);

  const tutorialCountMap = new Map(tutorialEvents.map((entry) => [entry._id, entry.count]));
  const uniqueActiveClientFirms = new Set(firmsWithActiveClients.map(String));
  const categoryFirmSet = new Set(firmIdsWithCategories.map(String));
  const workbasketFirmSet = new Set(firmIdsWithWorkbaskets.map(String));
  const managerQueueSet = new Set(managerIdsWithQueues.map(String));
  const assignedDocketSet = new Set(usersWithAssignedDockets.map((value) => String(value || '').toUpperCase()));

  const managers = await User.find({
    role: 'MANAGER',
    status: { $ne: 'deleted' },
  }).select('_id').lean();

  const standardUsers = await User.find({
    role: 'USER',
    status: { $ne: 'deleted' },
  }).select('xID xid').lean();

  const managersWithoutAssignedQueues = managers.filter((manager) => !managerQueueSet.has(String(manager._id))).length;
  const usersWithoutAssignedDockets = standardUsers.filter((user) => {
    const xid = String(user.xID || user.xid || '').toUpperCase();
    return xid ? !assignedDocketSet.has(xid) : true;
  }).length;

  return {
    timeframe: {
      sinceDays: Number(sinceDays),
      staleAfterDays: Number(staleAfterDays),
      generatedAt: now,
    },
    firmOverview: {
      totalFirms,
      firmsWithZeroActiveClients: Math.max(totalFirms - uniqueActiveClientFirms.size, 0),
      firmsWithoutCategoryOrWorkbasket: Array.from(new Set([
        ...Array.from(categoryFirmSet).filter((firmId) => !workbasketFirmSet.has(firmId)),
        ...Array.from(workbasketFirmSet).filter((firmId) => !categoryFirmSet.has(firmId)),
      ])).length,
    },
    roleCompletion: usersByCompletion,
    incompleteStepsByRole: incompleteByRole,
    tutorialFunnel: {
      completed: tutorialCountMap.get('welcome_tutorial_completed') || 0,
      skipped: tutorialCountMap.get('welcome_tutorial_skipped') || 0,
      skippedStillIncompleteAfterThreshold: skippedStillIncomplete,
    },
    stepCompletionByRole: blockerEvents,
    blockers: {
      managersWithoutAssignedQueues,
      usersWithoutAssignedDockets,
    },
    recentEvents,
  };
};

const BLOCKER_TYPES = new Set([
  'zero_active_clients',
  'missing_category_or_workbasket',
  'manager_without_queue',
  'user_without_dockets',
  'tutorial_skipped_incomplete',
  'stale_onboarding',
]);

const safeObjectId = (value) => {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (error) {
    return null;
  }
};

const toRoleArray = (value) => {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((role) => normalizeRole(role)).filter((role) => ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'].includes(role));
};

const getOnboardingInsightDetails = async ({
  sinceDays = 30,
  staleAfterDays = 7,
  role = null,
  blockerType = null,
  completionState = 'all',
  limit = 50,
  firmId = null,
} = {}) => {
  const now = new Date();
  const since = new Date(now.getTime() - (Number(sinceDays) * 24 * 60 * 60 * 1000));
  const staleThreshold = new Date(now.getTime() - (Number(staleAfterDays) * 24 * 60 * 60 * 1000));
  const normalizedRoleFilter = toRoleArray(role);
  const normalizedBlockerType = BLOCKER_TYPES.has(String(blockerType || '').trim()) ? String(blockerType).trim() : null;
  const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const resolvedFirmId = safeObjectId(firmId);

  const userMatch = {
    role: { $in: ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'] },
    status: { $ne: 'deleted' },
  };
  if (resolvedFirmId) {
    userMatch.firmId = resolvedFirmId;
  }
  if (normalizedRoleFilter.length) {
    userMatch.role = { $in: normalizedRoleFilter };
  }

  const [usersRaw, firmsRaw, activeClientFirmIds, categoryFirmIds, workbasketFirmIds, managerIdsWithQueues, usersWithAssignedDockets, recentEvents] = await Promise.all([
    User.find(userMatch)
      .select('_id firmId role xID xid onboardingTelemetry tutorialState isActive status')
      .lean(),
    Firm.find(resolvedFirmId ? { _id: resolvedFirmId } : { status: { $ne: 'deleted' } })
      .select('_id name firmId firmSlug status')
      .lean(),
    Client.distinct('firmId', resolvedFirmId ? { status: 'active', isActive: { $ne: false }, firmId: resolvedFirmId } : { status: 'active', isActive: { $ne: false } }),
    Category.distinct('firmId', resolvedFirmId ? { isActive: { $ne: false }, firmId: resolvedFirmId } : { isActive: { $ne: false } }),
    Team.distinct('firmId', resolvedFirmId ? { isActive: { $ne: false }, type: 'PRIMARY', firmId: resolvedFirmId } : { isActive: { $ne: false }, type: 'PRIMARY' }),
    Team.distinct('managerId', { isActive: { $ne: false }, type: 'PRIMARY' }),
    Case.distinct('assignedToXID', { assignedToXID: { $nin: [null, ''] } }),
    OnboardingEvent.find(resolvedFirmId ? { createdAt: { $gte: since }, firmId: resolvedFirmId } : { createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(Math.min(normalizedLimit, 30))
      .select('eventName role stepId source userXID firmId createdAt')
      .lean(),
  ]);

  const firmMap = new Map(firmsRaw.map((firm) => [String(firm._id), firm]));
  const activeClientFirmSet = new Set(activeClientFirmIds.map(String));
  const categoryFirmSet = new Set(categoryFirmIds.map(String));
  const workbasketFirmSet = new Set(workbasketFirmIds.map(String));
  const managerQueueSet = new Set(managerIdsWithQueues.map(String));
  const assignedDocketSet = new Set(usersWithAssignedDockets.map((xid) => String(xid || '').toUpperCase()));

  const completionStateMatches = (row) => {
    if (completionState === 'incomplete') return row.completionState !== 'completed';
    if (completionState === 'completed') return row.completionState === 'completed';
    if (completionState === 'stale') return row.isStale === true;
    return true;
  };

  const users = [];
  const byFirm = new Map();
  const stepFrequencyByRole = new Map();
  const blockerCountMap = new Map();
  const addBlockerCount = (key) => blockerCountMap.set(key, (blockerCountMap.get(key) || 0) + 1);

  for (const rawUser of usersRaw) {
    const firmKey = String(rawUser.firmId || '');
    if (!firmMap.has(firmKey)) continue;

    const telemetry = rawUser.onboardingTelemetry || {};
    const tutorialState = rawUser.tutorialState || {};
    const completed = Number(telemetry.lastProgressCompleted || 0);
    const total = Number(telemetry.lastProgressTotal || 0);
    const incompleteStepIds = Array.isArray(telemetry.lastIncompleteStepIds) ? telemetry.lastIncompleteStepIds.filter(Boolean) : [];
    const refreshedAt = telemetry.lastProgressRefreshedAt ? new Date(telemetry.lastProgressRefreshedAt) : null;
    const isStale = !refreshedAt || refreshedAt <= staleThreshold;
    const completionStateForUser = total > 0 && completed >= total ? 'completed' : (total > 0 ? 'incomplete' : 'no_progress');
    const hasSkippedTutorial = Boolean(tutorialState.skippedAt);

    const userBlockers = [];
    if (isStale) {
      userBlockers.push('stale_onboarding');
      addBlockerCount('stale_onboarding');
    }
    if (rawUser.role === 'MANAGER' && !managerQueueSet.has(String(rawUser._id))) {
      userBlockers.push('manager_without_queue');
      addBlockerCount('manager_without_queue');
    }
    if (rawUser.role === 'USER') {
      const xid = String(rawUser.xID || rawUser.xid || '').toUpperCase();
      if (!xid || !assignedDocketSet.has(xid)) {
        userBlockers.push('user_without_dockets');
        addBlockerCount('user_without_dockets');
      }
    }
    if (hasSkippedTutorial && completionStateForUser !== 'completed' && tutorialState.skippedAt && new Date(tutorialState.skippedAt) <= staleThreshold) {
      userBlockers.push('tutorial_skipped_incomplete');
      addBlockerCount('tutorial_skipped_incomplete');
    }

    for (const stepId of incompleteStepIds) {
      const key = `${rawUser.role}:${stepId}`;
      stepFrequencyByRole.set(key, (stepFrequencyByRole.get(key) || 0) + 1);
    }

    const userRow = {
      userId: String(rawUser._id),
      firmId: firmKey,
      role: rawUser.role,
      userXID: String(rawUser.xID || rawUser.xid || '').toUpperCase(),
      completedSteps: completed,
      totalSteps: total,
      incompleteStepIds,
      completionState: completionStateForUser,
      tutorial: {
        skipped: hasSkippedTutorial,
        completed: Boolean(tutorialState.completedAt),
      },
      lastProgressRefreshedAt: refreshedAt,
      isStale,
      blockers: userBlockers,
    };

    if (!completionStateMatches(userRow)) continue;
    if (normalizedBlockerType && !userBlockers.includes(normalizedBlockerType)) continue;
    users.push(userRow);

    const currentFirm = byFirm.get(firmKey) || {
      firmId: firmKey,
      name: firmMap.get(firmKey)?.name || 'Unknown firm',
      firmCode: firmMap.get(firmKey)?.firmId || null,
      firmSlug: firmMap.get(firmKey)?.firmSlug || null,
      status: firmMap.get(firmKey)?.status || null,
      users: 0,
      incompleteUsers: 0,
      staleUsers: 0,
      blockers: new Set(),
      recentRefreshAt: null,
    };
    currentFirm.users += 1;
    if (userRow.completionState !== 'completed') currentFirm.incompleteUsers += 1;
    if (userRow.isStale) currentFirm.staleUsers += 1;
    userBlockers.forEach((entry) => currentFirm.blockers.add(entry));
    if (userRow.lastProgressRefreshedAt && (!currentFirm.recentRefreshAt || userRow.lastProgressRefreshedAt > currentFirm.recentRefreshAt)) {
      currentFirm.recentRefreshAt = userRow.lastProgressRefreshedAt;
    }
    byFirm.set(firmKey, currentFirm);
  }


  if (resolvedFirmId && firmsRaw[0] && !byFirm.has(String(resolvedFirmId))) {
    const selectedFirm = firmsRaw[0];
    byFirm.set(String(resolvedFirmId), {
      firmId: String(selectedFirm._id),
      name: selectedFirm.name || 'Unknown firm',
      firmCode: selectedFirm.firmId || null,
      firmSlug: selectedFirm.firmSlug || null,
      status: selectedFirm.status || null,
      users: 0,
      incompleteUsers: 0,
      staleUsers: 0,
      blockers: new Set(),
      recentRefreshAt: null,
    });
  }

  const firms = Array.from(byFirm.values()).map((firm) => {
    const firmKey = String(firm.firmId);
    const firmBlockers = [];
    if (!activeClientFirmSet.has(firmKey)) {
      firmBlockers.push('zero_active_clients');
      addBlockerCount('zero_active_clients');
    }
    if (!categoryFirmSet.has(firmKey) || !workbasketFirmSet.has(firmKey)) {
      firmBlockers.push('missing_category_or_workbasket');
      addBlockerCount('missing_category_or_workbasket');
    }
    const allBlockers = new Set([...Array.from(firm.blockers), ...firmBlockers]);
    return {
      ...firm,
      blockers: Array.from(allBlockers),
      priorityScore: (firm.staleUsers * 2) + firm.incompleteUsers + (firmBlockers.length * 2),
      missingSetup: {
        hasActiveClient: activeClientFirmSet.has(firmKey),
        hasCategory: categoryFirmSet.has(firmKey),
        hasPrimaryWorkbasket: workbasketFirmSet.has(firmKey),
      },
      recentRefreshAt: firm.recentRefreshAt || null,
      nextAction: !activeClientFirmSet.has(firmKey)
        ? 'Needs first active client'
        : (!categoryFirmSet.has(firmKey) || !workbasketFirmSet.has(firmKey))
          ? 'Needs category/workbasket setup'
          : (allBlockers.has('manager_without_queue'))
            ? 'Managers need queue assignment'
            : (allBlockers.has('user_without_dockets'))
              ? 'Users have no assigned dockets'
              : (allBlockers.has('tutorial_skipped_incomplete'))
                ? 'Tutorial skipped but setup still incomplete'
                : (allBlockers.size ? 'Needs follow-up' : 'Healthy'),
    };
  })
    .filter((firm) => !normalizedBlockerType || firm.blockers.includes(normalizedBlockerType))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, normalizedLimit);

  const topIncompleteStepsByRole = Array.from(stepFrequencyByRole.entries())
    .map(([key, usersCount]) => {
      const [roleValue, stepId] = key.split(':');
      return { role: roleValue, stepId, users: usersCount };
    })
    .sort((a, b) => b.users - a.users)
    .slice(0, 15);

  const topBlockers = Array.from(blockerCountMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    timeframe: {
      sinceDays: Number(sinceDays),
      staleAfterDays: Number(staleAfterDays),
      generatedAt: now,
    },
    filtersApplied: {
      role: normalizedRoleFilter,
      blockerType: normalizedBlockerType,
      completionState,
      firmId: resolvedFirmId ? String(resolvedFirmId) : null,
    },
    totals: {
      firms: firms.length,
      users: users.length,
      staleUsers: users.filter((entry) => entry.isStale).length,
      needsFollowUpFirms: firms.filter((firm) => firm.nextAction !== 'Healthy').length,
    },
    topBlockers,
    firms,
    users: users.slice(0, normalizedLimit),
    topIncompleteStepsByRole,
    recentEvents,
  };
};

const ALERT_SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const classifyAlertSeverity = ({ blockerType, staleUsers = 0, incompleteUsers = 0, affectedUsers = 0 }) => {
  if (['zero_active_clients', 'missing_category_or_workbasket'].includes(blockerType)) return 'HIGH';
  if (blockerType === 'stale_onboarding' && Number(staleUsers) >= 3) return 'HIGH';
  if (blockerType === 'user_without_dockets' && Number(affectedUsers) >= 5) return 'HIGH';
  if (['manager_without_queue', 'user_without_dockets', 'tutorial_skipped_incomplete', 'stale_onboarding'].includes(blockerType)) {
    return 'MEDIUM';
  }
  if (Number(incompleteUsers) > 0) return 'MEDIUM';
  return 'LOW';
};

const resolveAgeBucket = (ageDays) => {
  if (ageDays >= 14) return '14d+';
  if (ageDays >= 7) return '7d+';
  if (ageDays >= 3) return '3d+';
  return '0-2d';
};

const getOnboardingAlerts = async ({
  sinceDays = 30,
  staleAfterDays = 7,
  severity = null,
  blockerType = null,
  ageBucket = null,
  status = 'open',
  limit = 50,
} = {}) => {
  const normalizedStatus = String(status || 'open').trim().toLowerCase();
  const onlyResolved = normalizedStatus === 'resolved';
  const includeAll = normalizedStatus === 'all';
  const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const normalizedBlockerType = BLOCKER_TYPES.has(String(blockerType || '').trim()) ? String(blockerType).trim() : null;
  const normalizedSeverity = ['HIGH', 'MEDIUM', 'LOW'].includes(String(severity || '').trim().toUpperCase())
    ? String(severity || '').trim().toUpperCase()
    : null;
  const normalizedAgeBucket = ['0-2d', '3d+', '7d+', '14d+'].includes(String(ageBucket || '').trim())
    ? String(ageBucket).trim()
    : null;

  if (onlyResolved) {
    return {
      timeframe: {
        sinceDays: Number(sinceDays),
        staleAfterDays: Number(staleAfterDays),
        generatedAt: new Date(),
      },
      filtersApplied: {
        status: 'resolved',
        severity: normalizedSeverity,
        blockerType: normalizedBlockerType,
        ageBucket: normalizedAgeBucket,
      },
      totals: {
        open: 0,
        bySeverity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      },
      alerts: [],
    };
  }

  const details = await getOnboardingInsightDetails({
    sinceDays,
    staleAfterDays,
    completionState: 'all',
    blockerType: normalizedBlockerType,
    limit: 100,
  });

  const now = new Date();
  const userCountByFirmAndBlocker = new Map();
  for (const user of details.users || []) {
    const blockers = Array.isArray(user.blockers) ? user.blockers : [];
    for (const type of blockers) {
      const key = `${user.firmId}:${type}`;
      userCountByFirmAndBlocker.set(key, (userCountByFirmAndBlocker.get(key) || 0) + 1);
    }
  }

  const blockerActionMap = {
    zero_active_clients: 'Add first active client',
    missing_category_or_workbasket: 'Configure category and primary workbasket',
    manager_without_queue: 'Assign manager to primary queue',
    user_without_dockets: 'Assign dockets to impacted users',
    tutorial_skipped_incomplete: 'Follow up on skipped tutorial users',
    stale_onboarding: 'Refresh onboarding state and confirm blockers',
  };

  const alerts = [];
  for (const firm of details.firms || []) {
    for (const type of firm.blockers || []) {
      if (normalizedBlockerType && normalizedBlockerType !== type) continue;

      const affectedUsers = Number(userCountByFirmAndBlocker.get(`${firm.firmId}:${type}`) || 0);
      const ageReference = firm.recentRefreshAt ? new Date(firm.recentRefreshAt) : now;
      const ageDays = Math.max(0, Math.floor((now.getTime() - ageReference.getTime()) / (24 * 60 * 60 * 1000)));
      const derivedAgeBucket = resolveAgeBucket(ageDays);
      const derivedSeverity = classifyAlertSeverity({
        blockerType: type,
        staleUsers: firm.staleUsers,
        incompleteUsers: firm.incompleteUsers,
        affectedUsers,
      });
      if (normalizedSeverity && normalizedSeverity !== derivedSeverity) continue;
      if (normalizedAgeBucket && normalizedAgeBucket !== derivedAgeBucket) continue;

      const detailParams = new URLSearchParams();
      detailParams.set('blockerType', type);
      detailParams.set('completionState', 'all');
      detailParams.set('sinceDays', String(Number(sinceDays)));
      detailParams.set('staleAfterDays', String(Number(staleAfterDays)));

      alerts.push({
        id: `${firm.firmId}:${type}`,
        status: 'open',
        title: `${firm.name}: ${type.replace(/_/g, ' ')}`,
        blockerType: type,
        severity: derivedSeverity,
        ageDays,
        ageBucket: derivedAgeBucket,
        suggestedNextAction: blockerActionMap[type] || 'Review onboarding detail',
        affected: {
          firmId: firm.firmId,
          firmName: firm.name,
          firmCode: firm.firmCode || null,
          affectedUsers,
        },
        links: {
          onboardingDetail: `/app/superadmin/onboarding-insights/${firm.firmId}?${detailParams.toString()}`,
          firmsManagement: '/app/superadmin/firms',
        },
      });
    }
  }

  const filteredAlerts = alerts
    .filter((entry) => includeAll || entry.status === 'open')
    .sort((a, b) => {
      const severityDiff = (ALERT_SEVERITY_RANK[b.severity] || 0) - (ALERT_SEVERITY_RANK[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return b.ageDays - a.ageDays;
    })
    .slice(0, normalizedLimit);

  const severityCounts = filteredAlerts.reduce((acc, row) => {
    acc[row.severity] += 1;
    return acc;
  }, { HIGH: 0, MEDIUM: 0, LOW: 0 });

  return {
    timeframe: {
      sinceDays: Number(sinceDays),
      staleAfterDays: Number(staleAfterDays),
      generatedAt: now,
    },
    filtersApplied: {
      status: includeAll ? 'all' : 'open',
      severity: normalizedSeverity,
      blockerType: normalizedBlockerType,
      ageBucket: normalizedAgeBucket,
    },
    totals: {
      open: filteredAlerts.length,
      bySeverity: severityCounts,
    },
    alerts: filteredAlerts,
  };
};

module.exports = {
  createEvent,
  recordProgressIfChanged,
  getOnboardingInsights,
  getOnboardingInsightDetails,
  getOnboardingAlerts,
};
