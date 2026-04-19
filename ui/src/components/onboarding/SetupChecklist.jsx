import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common/Button';
import { mergeProgressWithManual } from './setupChecklistModel';
import './SetupChecklist.css';

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
  } catch (_error) {
    return { dismissed: false, manualSteps: {} };
  }
};

export const SetupChecklist = ({ storageKey, onAction, mode = 'admin', onboardingProgress = null }) => {
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
    const apiSteps = onboardingProgress?.steps || [];
    return mergeProgressWithManual({
      apiSteps,
      manualSteps,
      firmSlug: onboardingProgress?.firmSlug,
      mode,
    });
  }, [manualSteps, onboardingProgress, mode]);

  const completedSteps = steps.filter((step) => step.completed).length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  if (!steps.length || dismissed || completedSteps === steps.length) {
    return null;
  }

  const handleNavigate = (step) => {
    onAction?.(step);
  };

  const handleManualComplete = (step) => {
    if (!step.canManualComplete || step.completed) return;

    const nextState = {
      dismissed: false,
      manualSteps: {
        ...manualSteps,
        [step.id]: true,
      },
    };
    persistState(nextState);
  };

  return (
    <section className="setup-checklist" aria-labelledby="setup-checklist-title">
      <div className="setup-checklist__header">
        <div>
          <p className="setup-checklist__eyebrow">First-time setup</p>
          <h2 className="setup-checklist__title" id="setup-checklist-title">Launch your workspace with confidence</h2>
          <p className="setup-checklist__description">
            Progress is detected from your real workspace data wherever possible.
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
        {steps.map((step, index) => (
          <article
            key={step.id}
            className={`setup-checklist__item${step.completed ? ' setup-checklist__item--complete' : ''}`}
            title={step.explanation}
          >
            <div className="setup-checklist__status" aria-hidden="true">
              {step.completed ? '✓' : String(index + 1)}
            </div>
            <div>
              <h3 className="setup-checklist__item-title">{step.title}</h3>
              <p className="setup-checklist__item-description">{step.description}</p>
              <div className="setup-checklist__item-footer">
                <span className="setup-checklist__hint">
                  {step.completed
                    ? (step.source === 'detected' ? 'Detected from your workspace setup' : 'Marked complete manually')
                    : (step.completionMode === 'manual' ? `Manual acknowledgment required · ${step.explanation}` : step.explanation)}
                </span>
                {!step.completed && (
                  <div className="flex items-center gap-2">
                    {step.route ? (
                      <Button variant="outline" onClick={() => handleNavigate(step)}>
                        {step.actionLabel || 'Open step'}
                      </Button>
                    ) : null}
                    {step.canManualComplete ? (
                      <Button variant="secondary" onClick={() => handleManualComplete(step)}>
                        Mark complete
                      </Button>
                    ) : null}
                  </div>
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
