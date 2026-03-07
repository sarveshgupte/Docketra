import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common/Button';
import './SetupChecklist.css';

const CHECKLIST_STEPS = [
  {
    id: 'create-case',
    title: 'Create your first case',
    description: 'Start your workspace with a live compliance record so dashboards and queues have real work to track.',
    hint: 'Best first move for a brand-new workspace.',
  },
  {
    id: 'assign-owner',
    title: 'Assign an owner',
    description: 'Clear ownership keeps work moving and makes accountability visible in the worklist.',
    hint: 'Use the case registry to assign an executive.',
  },
  {
    id: 'invite-team',
    title: 'Invite a team member',
    description: 'Add collaborators so work can move from intake to review without bottlenecks.',
    hint: 'Open team management to invite or activate a teammate.',
  },
  {
    id: 'configure-firm',
    title: 'Configure firm profile',
    description: 'Set your operating defaults and firm details before you scale the workspace.',
    hint: 'Review firm settings and update your profile details.',
  },
  {
    id: 'review-insights',
    title: 'Review dashboard insights',
    description: 'Use the risk and workload indicators to understand what needs attention this week.',
    hint: 'You are here — review the KPI cards and workflow summary.',
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

export const SetupChecklist = ({ storageKey, recentCases = [], onAction }) => {
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

    return CHECKLIST_STEPS.map((step) => {
      const autoComplete = step.id === 'create-case'
        ? hasCases
        : step.id === 'assign-owner'
          ? hasAssignedCase
          : step.id === 'review-insights';

      return {
        ...step,
        complete: autoComplete || Boolean(manualSteps[step.id]),
      };
    });
  }, [manualSteps, recentCases]);

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
            Follow this guided checklist to turn a blank workspace into a fully operational firm dashboard.
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
                    Open step
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
