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

module.exports = {
  createEvent,
  recordProgressIfChanged,
  getOnboardingInsights,
};
