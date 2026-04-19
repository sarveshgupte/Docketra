import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common/Button';
import './SetupChecklist.css';

const ADMIN_CHECKLIST_STEPS = [
  {
    id: 'create-case',
    title: 'Create your first docket',
    description: 'Start your workspace with a live compliance record so dashboards and queues have real work to track.',
    hint: 'Best first move for a brand-new workspace.',
    actionLabel: 'Create docket',
  },
  {
    id: 'assign-owner',
    title: 'Assign an owner',
    description: 'Clear ownership keeps work moving and makes accountability visible in the worklist.',
    hint: 'Use the docket registry to assign an executive.',
    actionLabel: 'Open docket registry',
  },
  {
    id: 'invite-team',
    title: 'Invite a team member',
    description: 'Add collaborators so work can move from intake to review without bottlenecks.',
    hint: 'Open team management to invite or activate a teammate.',
    actionLabel: 'Open team management',
  },
  {
    id: 'configure-firm',
    title: 'Configure firm profile',
    description: 'Set your operating defaults and firm details before you scale the workspace.',
    hint: 'Review firm settings and update your profile details.',
    actionLabel: 'Open firm settings',
  },
  {
    id: 'review-insights',
    title: 'Review dashboard insights',
    description: 'Use the risk and workload indicators to understand what needs attention this week.',
    hint: 'You are here — review the KPI cards and workflow summary.',
    actionLabel: 'Review dashboard',
  },
];

const PRIMARY_ADMIN_CHECKLIST_STEPS = [
  {
    id: 'firm-profile',
    title: 'Confirm firm profile and defaults',
    description: 'Review firm details, operating defaults, and compliance preferences before inviting the wider team.',
    hint: 'Open Firm Settings to finalize your foundation.',
    actionLabel: 'Open firm settings',
  },
  {
    id: 'storage-setup',
    title: 'Connect document storage',
    description: 'Configure your storage provider so docket files, evidences, and uploads are handled in your preferred environment.',
    hint: 'Open Storage Settings and connect your provider.',
    actionLabel: 'Open storage settings',
  },
  {
    id: 'configure-categories',
    title: 'Configure categories and work types',
    description: 'Define docket categories and work type structure to keep intake, filters, and reporting consistent across the firm.',
    hint: 'Use Work Settings to set your service taxonomy.',
    actionLabel: 'Open work settings',
  },
  {
    id: 'invite-team',
    title: 'Invite admins and team members',
    description: 'Set up your execution team so work can be assigned, reviewed, and closed without bottlenecks.',
    hint: 'Open Admin and invite your first users.',
    actionLabel: 'Open team management',
  },
  {
    id: 'create-case',
    title: 'Create and assign first docket',
    description: 'Launch your first docket and assign ownership to validate your end-to-end operating workflow.',
    hint: 'Create a docket, then assign owner from docket registry.',
    actionLabel: 'Create docket',
  },
];


const MANAGER_CHECKLIST_STEPS = [
  {
    id: 'review-workbaskets',
    title: 'Review assigned workbaskets',
    description: 'Confirm which queues your team owns so intake and execution responsibilities are clear.',
    hint: 'Open Worklist/Workbaskets and verify ownership.',
    actionLabel: 'Open worklist',
  },
  {
    id: 'review-pending',
    title: 'Review pending and overdue dockets',
    description: 'Catch bottlenecks early and rebalance workload before turnaround risk grows.',
    hint: 'Use queue filters to prioritize due-soon items.',
    actionLabel: 'Open queue filters',
  },
  {
    id: 'qc-handoff',
    title: 'Validate QC handoff process',
    description: 'Ensure quality checkpoints are followed before dockets are marked resolved.',
    hint: 'Open QC queue to check waiting items.',
    actionLabel: 'Open QC queue',
  },
];

const USER_CHECKLIST_STEPS = [
  {
    id: 'review-assigned',
    title: 'Review your assigned dockets',
    description: 'Start with overdue and due-soon work so deadlines do not slip.',
    hint: 'Open My Worklist first each day.',
    actionLabel: 'Open My Worklist',
  },
  {
    id: 'update-status',
    title: 'Update your first docket cleanly',
    description: 'Keep status, comments, and evidence current so the next handoff is clear and auditable.',
    hint: 'Open a docket and add a progress update.',
    actionLabel: 'Open dockets',
  },
  {
    id: 'check-calendar',
    title: 'Review compliance timeline',
    description: 'Use the compliance calendar to avoid last-minute work and missed filings.',
    hint: 'Track items due this week.',
    actionLabel: 'Open compliance calendar',
  },
];

const readStoredState = (storageKey) => {
  if (!storageKey) return { dismissed: false, manualSteps: {} };

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { dismissed: false, manualSteps: {} };
    const parsed = JSON.parse(raw);
    return {
      dismissed: Boolean(parsed.dismissed),
      manualSteps: parsed.manualSteps || {},
    };
  } catch (error) {
    return { dismissed: false, manualSteps: {} };
  }
};

export const SetupChecklist = ({ storageKey, recentCases = [], onAction, mode = 'admin' }) => {
  const [{ dismissed, manualSteps }, setChecklistState] = useState(readStoredState(storageKey));

  useEffect(() => {
    setChecklistState(readStoredState(storageKey));
  }, [storageKey]);

  const persistState = (nextState) => {
    setChecklistState(nextState);
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(nextState));
  };

  const steps = useMemo(() => {
    const hasCases = recentCases.length > 0;
    const hasAssignedCase = recentCases.some((caseItem) =>
      Boolean(caseItem.assignedToName || caseItem.assignedTo || caseItem.assignedToXID)
    );

    const checklistSteps = mode === 'primary-admin'
      ? PRIMARY_ADMIN_CHECKLIST_STEPS
      : (mode === 'manager' ? MANAGER_CHECKLIST_STEPS : (mode === 'user' ? USER_CHECKLIST_STEPS : ADMIN_CHECKLIST_STEPS));
    return checklistSteps.map((step) => {
      let autoComplete = false;

      if (step.id === 'create-case') {
        autoComplete = hasCases;
      } else if (step.id === 'assign-owner') {
        autoComplete = hasAssignedCase;
      }

      return {
        ...step,
        complete: autoComplete || Boolean(manualSteps[step.id]),
      };
    });
  }, [manualSteps, recentCases, mode]);

  const completedSteps = steps.filter((step) => step.complete).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  if (dismissed || completedSteps === steps.length) {
    return null;
  }

  const handleAction = (stepId) => {
    const nextState = {
      dismissed: false,
      manualSteps: {
        ...manualSteps,
        [stepId]: true,
      },
    };
    persistState(nextState);
    onAction?.(stepId);
  };

  return (
    <section className="setup-checklist" aria-labelledby="setup-checklist-title">
      <div className="setup-checklist__header">
        <div>
          <p className="setup-checklist__eyebrow">First-time setup</p>
          <h2 className="setup-checklist__title" id="setup-checklist-title">Launch your workspace with confidence</h2>
          <p className="setup-checklist__description">
            Follow this checklist to move from first login to a reliable daily workflow in Docketra.
          </p>
        </div>

        <div className="setup-checklist__meta">
          <div className="setup-checklist__progress-copy">
            <span>Progress</span>
            <span>{completedSteps}/{steps.length} complete</span>
          </div>
          <div
            className="setup-checklist__progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Workspace setup progress"
          >
            <div className="setup-checklist__progress-value" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="setup-checklist__list">
        {steps.map((step) => (
          <article
            key={step.id}
            className={`setup-checklist__item${step.complete ? ' setup-checklist__item--complete' : ''}`}
            title={step.hint}
          >
            <div className="setup-checklist__status" aria-hidden="true">
              {step.complete ? '✓' : String(steps.findIndex((item) => item.id === step.id) + 1)}
            </div>
            <div>
              <h3 className="setup-checklist__item-title">{step.title}</h3>
              <p className="setup-checklist__item-description">{step.description}</p>
              <div className="setup-checklist__item-footer">
                <span className="setup-checklist__hint">{step.hint}</span>
                {!step.complete && (
                  <Button variant="outline" onClick={() => handleAction(step.id)}>
                    {step.actionLabel || 'Open step'}
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="setup-checklist__dismiss">
        <Button
          variant="secondary"
          onClick={() => persistState({ dismissed: true, manualSteps })}
          style={{ marginTop: 'var(--space-4)' }}
        >
          Dismiss checklist
        </Button>
      </div>
    </section>
  );
};
