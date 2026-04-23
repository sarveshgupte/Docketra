import { CHECKLIST_COPY, resolveCtaRoute } from './setupChecklistModel';

export const ONBOARDING_BLOCKER_GUIDANCE = Object.freeze({
  setup_incomplete: {
    title: 'Finish firm profile setup',
    description: 'Your firm profile is still incomplete, so some onboarding flows stay blocked.',
    actionLabel: 'Complete firm settings',
    cta: 'firm-settings',
  },
  missing_routing: {
    title: 'Set category routing',
    description: 'At least one active category + subcategory pair is required before dockets can route correctly.',
    actionLabel: 'Open work settings',
    cta: 'work-settings',
  },
  inactive_workbench: {
    title: 'Create an active workbench',
    description: 'No active workbench is available, so new dockets cannot move into operational queues.',
    actionLabel: 'Configure workbench',
    cta: 'work-settings',
  },
  missing_client: {
    title: 'Add your first client',
    description: 'Client-linked dockets require at least one active client in this workspace.',
    actionLabel: 'Open clients',
    cta: 'clients',
  },
});

export const mapOnboardingBlocker = ({ blocker, firmSlug, mode = 'admin' }) => {
  const code = String(blocker?.code || '').trim().toLowerCase();
  const guidance = ONBOARDING_BLOCKER_GUIDANCE[code] || null;
  if (!guidance) {
    return {
      code,
      title: 'Resolve onboarding blocker',
      description: blocker?.message || 'A setup dependency is preventing smooth first-run workflow.',
      actionLabel: 'Open work settings',
      route: resolveCtaRoute('work-settings', firmSlug, mode),
      supportHint: blocker?.nextCheck || '',
    };
  }

  return {
    code,
    title: guidance.title,
    description: guidance.description,
    actionLabel: guidance.actionLabel,
    route: resolveCtaRoute(guidance.cta, firmSlug, mode),
    supportHint: blocker?.nextCheck || '',
  };
};

export const mapOnboardingStepsWithCopy = ({ steps = [], firmSlug, mode = 'admin' }) => (
  steps.map((step) => {
    const copy = CHECKLIST_COPY[step.id] || {};
    return {
      ...step,
      title: copy.title || step.title || step.id,
      description: copy.description || step.description || step.explanation || '',
      actionLabel: copy.actionLabel || 'Open step',
      route: resolveCtaRoute(step.cta, firmSlug, mode),
    };
  })
);
