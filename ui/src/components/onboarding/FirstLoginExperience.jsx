import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { productUpdatesService } from '../../services/productUpdatesService';
import { getRoleOnboardingContent, normalizeOnboardingRole } from './roleOnboardingContent';
import { resolveTutorialPersistenceIntent } from './firstLoginFlowPersistence';

const FLOW_STEPS = ['welcome', 'what-is', 'role', 'can-do', 'start-here', 'quick-checklist'];

export const FirstLoginExperience = () => {
  const { user, isAuthResolved, isAuthenticated, updateUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const serverShowTutorial = Boolean(user?.welcomeTutorial?.show);
  const showTutorial = Boolean(serverShowTutorial || manualOpen);
  const isFirstLoginTutorial = Boolean(serverShowTutorial);
  const showWhatsNew = !showTutorial && Boolean(user?.whatsNew?.show && user?.whatsNew?.update?._id);
  const roleKey = normalizeOnboardingRole(user?.welcomeTutorial?.role || user?.role);
  const content = useMemo(() => getRoleOnboardingContent(roleKey), [roleKey]);

  useEffect(() => {
    const handleReplay = () => {
      setStepIndex(0);
      setManualOpen(true);
    };

    window.addEventListener('docketra:replay-welcome-tutorial', handleReplay);
    return () => window.removeEventListener('docketra:replay-welcome-tutorial', handleReplay);
  }, []);

  if (!isAuthResolved || !isAuthenticated || !user) {
    return null;
  }

  const completeTutorial = async (status = 'completed') => {
    const persistencePayload = resolveTutorialPersistenceIntent({
      serverShowTutorial,
      action: status,
      role: roleKey,
      stepIndex,
    });

    if (!persistencePayload) {
      setStepIndex(0);
      setManualOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      await productUpdatesService.completeTutorial(persistencePayload);
      updateUser({
        welcomeTutorial: {
          ...(user?.welcomeTutorial || {}),
          show: false,
          status,
        },
      });
    } finally {
      setSubmitting(false);
      setStepIndex(0);
      setManualOpen(false);
    }
  };

  const handleDismissWhatsNew = async () => {
    const updateId = user?.whatsNew?.update?._id;
    if (!updateId) return;

    try {
      setSubmitting(true);
      await productUpdatesService.markSeen(updateId);
      updateUser({
        lastSeenUpdateId: updateId,
        whatsNew: {
          ...(user?.whatsNew || {}),
          show: false,
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const stepKey = FLOW_STEPS[stepIndex];
  const totalSteps = FLOW_STEPS.length;
  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <>
      <Modal
        isOpen={showTutorial}
        onClose={() => completeTutorial(isFirstLoginTutorial ? 'skipped' : 'completed')}
        title={`Welcome to Docketra · ${content.roleLabel}`}
        size="lg"
        actions={(
          <>
            <Button variant="secondary" onClick={() => completeTutorial('skipped')} disabled={submitting}>
              Skip for now
            </Button>
            <Button variant="outline" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={submitting || stepIndex === 0}>
              Back
            </Button>
            <Button variant="primary" onClick={() => (isLastStep ? completeTutorial('completed') : setStepIndex((current) => current + 1))} disabled={submitting}>
              {isLastStep ? 'Finish tutorial' : 'Next'}
            </Button>
          </>
        )}
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue-700" aria-live="polite">
          Step {stepIndex + 1} of {totalSteps}
        </p>

        {stepKey === 'welcome' ? (
          <div className="space-y-3 text-sm text-gray-700">
            <p>Welcome to your Docketra workspace.</p>
            <p>
              This short tutorial explains what Docketra is, your role, what actions you can take,
              and how to start your first productive day without guesswork.
            </p>
          </div>
        ) : null}

        {stepKey === 'what-is' ? (
          <div className="space-y-3 text-sm text-gray-700">
            <h3 className="text-base font-semibold text-gray-900">What is Docketra?</h3>
            <p>{content.whatIsDocketra}</p>
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">Learn more about core terms</summary>
              <p className="mt-2 text-sm text-slate-700">
                Dockets are your core work records. Clients, categories, and sub-categories structure the work.
                Workbaskets and QC workbaskets route operational handoffs. Audit history captures who changed what and when.
              </p>
            </details>
          </div>
        ) : null}

        {stepKey === 'role' ? (
          <div className="space-y-3 text-sm text-gray-700">
            <h3 className="text-base font-semibold text-gray-900">What is your role here?</h3>
            <p>{content.roleSummary}</p>
          </div>
        ) : null}

        {stepKey === 'can-do' ? (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">What can you do?</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
              {content.canDo.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {stepKey === 'start-here' ? (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">Where should you start?</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
              {content.startHere.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}

        {stepKey === 'quick-checklist' ? (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">Quick start checklist</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {content.checklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-0.5 text-green-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={showWhatsNew}
        onClose={handleDismissWhatsNew}
        title="What’s New 🚀"
        actions={(
          <Button variant="primary" onClick={handleDismissWhatsNew} disabled={submitting}>
            Got it
          </Button>
        )}
      >
        <p className="text-sm font-semibold text-gray-900">{user?.whatsNew?.update?.title || 'Latest updates'}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
          {(user?.whatsNew?.update?.content || []).map((bullet, index) => (
            <li key={`${index}-${bullet}`}>{bullet}</li>
          ))}
        </ul>
      </Modal>
    </>
  );
};
