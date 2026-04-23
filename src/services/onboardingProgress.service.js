const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Team = require('../models/Team.model');
const User = require('../models/User.model');
const Case = require('../models/Case.model');
const { DocketActivity } = require('../models/DocketActivity.model');
const { normalizeRole } = require('../utils/role.utils');
const { REASON_CODES } = require('./pilotDiagnostics.service');

const SOURCE = Object.freeze({
  DETECTED: 'detected',
  MANUAL: 'manual',
});

const buildStep = ({ id, completed, explanation, cta, completionMode = 'detected' }) => ({
  id,
  completed: Boolean(completed),
  source: Boolean(completed) ? SOURCE.DETECTED : SOURCE.MANUAL,
  explanation,
  cta,
  completionMode,
});

const getSharedSignals = async ({ firmId, user }) => {
  const normalizedFirmId = String(firmId || '');
  const userObjectId = user?._id || null;
  const userXid = String(user?.xID || user?.xid || '').toUpperCase();

  const [
    firm,
    activeClientCount,
    categoryCount,
    categoryWithSubcategoryCount,
    workbasketCount,
    docketCount,
    invitedOrActiveUsers,
    unassignedDocketCount,
    userAssignedWorkbasketCount,
    managerWorkbasketCount,
    qcMappingCount,
    managerVisibleQueueCount,
    userAssignedDocketCount,
    userInteractionCount,
  ] = await Promise.all([
    Firm.findById(firmId).select('isSetupComplete storage.mode storageConfig.provider').lean(),
    Client.countDocuments({ firmId, status: 'active', isActive: { $ne: false } }),
    Category.countDocuments({ firmId, isActive: { $ne: false } }),
    Category.countDocuments({
      firmId,
      isActive: { $ne: false },
      subcategories: { $elemMatch: { isActive: { $ne: false } } },
    }),
    Team.countDocuments({ firmId, isActive: { $ne: false }, type: 'PRIMARY' }),
    Case.countDocuments({ firmId: normalizedFirmId }),
    User.countDocuments({
      firmId,
      status: { $in: ['invited', 'active'] },
      isActive: { $ne: false },
      isSystem: { $ne: true },
    }),
    Case.countDocuments({ firmId: normalizedFirmId, assignedToXID: { $in: [null, ''] } }),
    userObjectId
      ? Team.countDocuments({
        firmId,
        isActive: { $ne: false },
        type: 'PRIMARY',
        $or: [{ managerId: userObjectId }, { _id: { $in: user.teamIds || [] } }, { _id: user.teamId }],
      })
      : 0,
    userObjectId
      ? Team.countDocuments({ firmId, isActive: { $ne: false }, type: 'PRIMARY', managerId: userObjectId })
      : 0,
    Team.countDocuments({ firmId, isActive: { $ne: false }, type: 'QC', parentWorkbasketId: { $ne: null } }),
    userObjectId
      ? Case.countDocuments({
        firmId: normalizedFirmId,
        $or: [
          { assignedToXID: userXid },
          { workbasketId: { $in: (user.teamIds || []).filter(Boolean) } },
          { ownerTeamId: { $in: (user.teamIds || []).filter(Boolean) } },
          { routedToTeamId: { $in: (user.teamIds || []).filter(Boolean) } },
        ],
      })
      : 0,
    userXid
      ? Case.countDocuments({ firmId: normalizedFirmId, assignedToXID: userXid })
      : 0,
    userXid
      ? DocketActivity.countDocuments({ firmId, performedByXID: userXid })
      : 0,
  ]);

  return {
    firm,
    activeClientCount,
    categoryCount,
    categoryWithSubcategoryCount,
    workbasketCount,
    docketCount,
    invitedOrActiveUsers,
    unassignedDocketCount,
    userAssignedWorkbasketCount,
    managerWorkbasketCount,
    qcMappingCount,
    managerVisibleQueueCount,
    userAssignedDocketCount,
    userInteractionCount,
  };
};


const buildBlockers = ({ signals }) => {
  const blockers = [];
  if (!signals?.firm?.isSetupComplete) {
    blockers.push({ code: REASON_CODES.SETUP_INCOMPLETE, message: 'Firm profile setup is incomplete.', nextCheck: 'Complete firm defaults and onboarding checklist.' });
  }
  if ((signals?.categoryWithSubcategoryCount || 0) === 0) {
    blockers.push({ code: REASON_CODES.MISSING_ROUTING, message: 'No active category/subcategory routing found.', nextCheck: 'Create at least one active category + subcategory pair.' });
  }
  if ((signals?.workbasketCount || 0) === 0) {
    blockers.push({ code: REASON_CODES.INACTIVE_WORKBENCH, message: 'No active workbench is available for docket routing.', nextCheck: 'Create or reactivate a primary workbench in Work Settings.' });
  }
  return blockers;
};

const buildRoleSteps = ({ role, signals }) => {
  const {
    firm,
    activeClientCount,
    categoryCount,
    categoryWithSubcategoryCount,
    workbasketCount,
    docketCount,
    invitedOrActiveUsers,
    unassignedDocketCount,
    userAssignedWorkbasketCount,
    managerWorkbasketCount,
    qcMappingCount,
    managerVisibleQueueCount,
    userAssignedDocketCount,
    userInteractionCount,
  } = signals;

  if (role === 'PRIMARY_ADMIN') {
    return [
      buildStep({
        id: 'firm-profile',
        completed: Boolean(firm?.isSetupComplete),
        explanation: firm?.isSetupComplete ? 'Detected from your workspace setup.' : 'Complete firm defaults in Firm Settings.',
        cta: 'firm-settings',
      }),
      buildStep({
        id: 'storage-setup',
        completed: firm?.storage?.mode === 'firm_connected' && Boolean(firm?.storageConfig?.provider),
        explanation: firm?.storage?.mode === 'firm_connected'
          ? 'Detected from your workspace setup.'
          : 'Connect BYOS storage in Storage Settings.',
        cta: 'storage-settings',
      }),
      buildStep({
        id: 'active-client',
        completed: activeClientCount > 0,
        explanation: activeClientCount > 0 ? 'Detected from your workspace setup.' : 'Waiting for first client to be added.',
        cta: 'clients',
      }),
      buildStep({
        id: 'categories-workbaskets',
        completed: categoryWithSubcategoryCount > 0 && workbasketCount > 0,
        explanation: (categoryWithSubcategoryCount > 0 && workbasketCount > 0)
          ? 'Detected from your workspace setup.'
          : 'Add category/sub-category mapping and at least one workbasket.',
        cta: 'work-settings',
      }),
      buildStep({
        id: 'invite-team',
        completed: invitedOrActiveUsers > 0,
        explanation: invitedOrActiveUsers > 0 ? 'Detected from your workspace setup.' : 'Invite at least one admin/manager/user.',
        cta: 'admin-team',
      }),
      buildStep({
        id: 'create-docket',
        completed: docketCount > 0,
        explanation: docketCount > 0 ? 'Detected from your workspace setup.' : 'Create your first docket to activate workflow.',
        cta: 'dockets',
      }),
    ];
  }

  if (role === 'ADMIN') {
    return [
      buildStep({
        id: 'workbasket-visibility',
        completed: workbasketCount > 0,
        explanation: workbasketCount > 0 ? 'Detected from your workspace setup.' : 'Pending workbasket assignment.',
        cta: 'worklist',
      }),
      buildStep({
        id: 'active-client',
        completed: activeClientCount > 0,
        explanation: activeClientCount > 0 ? 'Detected from your workspace setup.' : 'Waiting for first client to be added.',
        cta: 'clients',
      }),
      buildStep({
        id: 'categories-workbaskets',
        completed: categoryCount > 0 && workbasketCount > 0,
        explanation: (categoryCount > 0 && workbasketCount > 0)
          ? 'Detected from your workspace setup.'
          : 'Set up categories and workbaskets first.',
        cta: 'work-settings',
      }),
      buildStep({
        id: 'create-docket',
        completed: docketCount > 0,
        explanation: docketCount > 0 ? 'Detected from your workspace setup.' : 'No docket found yet.',
        cta: 'dockets',
      }),
      buildStep({
        id: 'unassigned-reviewed',
        completed: unassignedDocketCount === 0,
        explanation: unassignedDocketCount === 0
          ? 'Detected from your workspace setup.'
          : 'Unassigned dockets still need routing.',
        cta: 'global-worklist',
      }),
    ];
  }

  if (role === 'MANAGER') {
    return [
      buildStep({
        id: 'assigned-workbaskets',
        completed: managerWorkbasketCount > 0 || userAssignedWorkbasketCount > 0,
        explanation: (managerWorkbasketCount > 0 || userAssignedWorkbasketCount > 0)
          ? 'Detected from your workspace setup.'
          : 'Pending workbasket assignment.',
        cta: 'worklist',
      }),
      buildStep({
        id: 'qc-mapping',
        completed: qcMappingCount > 0,
        explanation: qcMappingCount > 0 ? 'Detected from your workspace setup.' : 'QC queue mapping is not configured yet.',
        cta: 'qc-queue',
      }),
      buildStep({
        id: 'team-visible-queue',
        completed: managerVisibleQueueCount > 0,
        explanation: managerVisibleQueueCount > 0
          ? 'Detected from your workspace setup.'
          : 'No dockets visible in your assigned queue yet.',
        cta: 'worklist',
      }),
    ];
  }

  return [
    buildStep({
      id: 'assigned-workbaskets',
      completed: userAssignedWorkbasketCount > 0,
      explanation: userAssignedWorkbasketCount > 0 ? 'Detected from your workspace setup.' : 'Pending workbasket assignment.',
      cta: 'my-worklist',
    }),
    buildStep({
      id: 'assigned-docket',
      completed: userAssignedDocketCount > 0,
      explanation: userAssignedDocketCount > 0 ? 'Detected from your workspace setup.' : 'No assigned dockets yet.',
      cta: 'my-worklist',
    }),
    buildStep({
      id: 'first-workflow-update',
      completed: userInteractionCount > 0,
      explanation: userInteractionCount > 0
        ? 'Detected from your workspace setup.'
        : 'Update one docket to complete your first workflow action.',
      cta: 'dockets',
    }),
  ];
};

const getOnboardingProgress = async ({ firmId, user }) => {
  const role = normalizeRole(user?.role) || 'USER';
  const signals = await getSharedSignals({ firmId, user });
  const steps = buildRoleSteps({ role, signals });
  const completed = steps.filter((step) => step.completed).length;

  const blockers = buildBlockers({ signals });

  return {
    role,
    completed,
    total: steps.length,
    steps,
    blockers,
    signals: {
      activeClientCount: signals.activeClientCount,
      categoryCount: signals.categoryCount,
      workbasketCount: signals.workbasketCount,
      docketCount: signals.docketCount,
      unassignedDocketCount: signals.unassignedDocketCount,
    },
  };
};

module.exports = {
  getOnboardingProgress,
  buildRoleSteps,
};
