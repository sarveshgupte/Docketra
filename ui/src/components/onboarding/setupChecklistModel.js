import { ROUTES, safeRoute } from '../../constants/routes.js';

export const CHECKLIST_COPY = {
  'firm-profile': {
    title: 'Confirm firm profile and defaults',
    description: 'Review firm defaults and compliance preferences for your workspace.',
    actionLabel: 'Open firm settings',
    completionMode: 'detected',
  },
  'storage-setup': {
    title: 'Connect document storage',
    description: 'Configure BYOS so docket files stay in your preferred environment.',
    actionLabel: 'Open storage settings',
    completionMode: 'detected',
  },
  'active-client': {
    title: 'Add first active client',
    description: 'Clients are required before production dockets can run cleanly.',
    actionLabel: 'Open clients',
    completionMode: 'detected',
  },
  'categories-workbaskets': {
    title: 'Configure categories and workbaskets',
    description: 'Define taxonomy and queue ownership for reliable routing.',
    actionLabel: 'Open work settings',
    completionMode: 'detected',
  },
  'invite-team': {
    title: 'Invite team members',
    description: 'Add admins, managers, and users so work can move end-to-end.',
    actionLabel: 'Open team management',
    completionMode: 'detected',
  },
  'create-docket': {
    title: 'Create first docket',
    description: 'Start with one live docket to activate workflow visibility.',
    actionLabel: 'Create docket',
    completionMode: 'detected',
  },
  'workbasket-visibility': {
    title: 'Validate workbasket visibility',
    description: 'Confirm queue visibility and team coverage before scaling intake.',
    actionLabel: 'Open worklist',
    completionMode: 'detected',
  },
  'unassigned-reviewed': {
    title: 'Review unassigned queue',
    description: 'Route any unassigned dockets so ownership is explicit.',
    actionLabel: 'Open global worklist',
    completionMode: 'detected',
  },
  'assigned-workbaskets': {
    title: 'Review assigned workbaskets',
    description: 'Validate your queue ownership and day-to-day execution scope.',
    actionLabel: 'Open worklist',
    completionMode: 'detected',
  },
  'qc-mapping': {
    title: 'Validate QC queue handoff',
    description: 'Ensure QC mapping exists before final docket completion.',
    actionLabel: 'Open QC queue',
    completionMode: 'detected',
  },
  'team-visible-queue': {
    title: 'Review team-visible queue',
    description: 'Confirm dockets are flowing into your assigned operational queues.',
    actionLabel: 'Open worklist',
    completionMode: 'detected',
  },
  'assigned-docket': {
    title: 'Open your first assigned docket',
    description: 'Start execution from your assigned queue.',
    actionLabel: 'Open My Worklist',
    completionMode: 'detected',
  },
  'first-workflow-update': {
    title: 'Complete your first workflow update',
    description: 'Add at least one status/comment update to create workflow history.',
    actionLabel: 'Open dockets',
    completionMode: 'detected',
  },
};

export const resolveCtaRoute = (ctaId, firmSlug, mode) => {
  const shared = {
    'firm-settings': safeRoute(ROUTES.FIRM_SETTINGS(firmSlug)),
    'storage-settings': safeRoute(ROUTES.STORAGE_SETTINGS(firmSlug)),
    clients: safeRoute(ROUTES.CLIENTS(firmSlug)),
    'work-settings': safeRoute(ROUTES.WORK_SETTINGS(firmSlug)),
    dockets: safeRoute(ROUTES.CASES(firmSlug)),
    worklist: safeRoute(mode === 'user' ? ROUTES.MY_WORKLIST(firmSlug) : ROUTES.WORKLIST(firmSlug)),
    'global-worklist': safeRoute(ROUTES.GLOBAL_WORKLIST(firmSlug)),
    'qc-queue': safeRoute(ROUTES.QC_QUEUE(firmSlug)),
    'my-worklist': safeRoute(ROUTES.MY_WORKLIST(firmSlug)),
    'admin-team': safeRoute(ROUTES.ADMIN(firmSlug)),
  };

  return shared[ctaId] || null;
};

const deriveCompletion = ({ step, manualComplete }) => {
  const backendComplete = Boolean(step.completed);
  const completionMode = step.completionMode || 'detected';

  if (completionMode === 'manual') {
    if (manualComplete) {
      return { completed: true, source: 'manual' };
    }
    if (backendComplete) {
      return { completed: true, source: 'detected' };
    }
    return { completed: false, source: 'manual' };
  }

  if (completionMode === 'hybrid') {
    if (backendComplete) return { completed: true, source: 'detected' };
    if (manualComplete) return { completed: true, source: 'manual' };
    return { completed: false, source: 'manual' };
  }

  return {
    completed: backendComplete,
    source: backendComplete ? 'detected' : 'manual',
  };
};

export const mergeProgressWithManual = ({ apiSteps = [], manualSteps = {}, firmSlug, mode }) => {
  return apiSteps.map((rawStep) => {
    const copy = CHECKLIST_COPY[rawStep.id] || {};
    const completionMode = rawStep.completionMode || copy.completionMode || 'detected';
    const manualComplete = Boolean(manualSteps[rawStep.id]);
    const { completed, source } = deriveCompletion({
      step: { ...rawStep, completionMode },
      manualComplete,
    });

    return {
      ...rawStep,
      ...copy,
      completionMode,
      completed,
      source,
      explanation: rawStep.explanation || (completed ? 'Detected from your workspace setup.' : 'Manual acknowledgment required.'),
      route: resolveCtaRoute(rawStep.cta, firmSlug, mode),
      canManualComplete: completionMode === 'manual' || completionMode === 'hybrid',
    };
  });
};
