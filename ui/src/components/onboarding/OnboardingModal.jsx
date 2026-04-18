import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { dashboardApi } from '../../api/dashboard.api';
import { ROUTES } from '../../constants/routes';

const STORAGE_PREFIX = 'docketra:onboarding';

const STEPS = [
  {
    key: 'intro',
    title: 'How Docketra works',
    description: 'Work starts in Workbaskets, moves into a user Worklist, and ends in QC for review and closure.',
    bullets: [
      'WB = intake and triage.',
      'WL = active execution by your team.',
      'QC = review, correction, and approval.',
    ],
  },
  {
    key: 'internal-client',
    title: 'Your INTERNAL workspace already exists',
    description: 'Every firm gets an INTERNAL client automatically. Use it for internal ops, compliance, and non-billable work.',
    bullets: [
      'You do not need to create the INTERNAL client manually.',
      'Create EXTERNAL clients only for customer work.',
    ],
  },
  {
    key: 'mapping',
    title: 'Create your first category + WB mapping',
    description: 'Define a category, then map it to the workbasket your team should pull from.',
    bullets: [
      'Set up categories and subcategories first.',
      'Then confirm workbasket ownership in settings.',
    ],
  },
  {
    key: 'team',
    title: 'Invite your team (optional)',
    description: 'Bring in admins, managers, and executors so work can move cleanly from WB to WL to QC.',
    bullets: [
      'You can skip this now and return later.',
    ],
  },
  {
    key: 'first-docket',
    title: 'Create the first docket',
    description: 'Start manually for a guided setup, or use CMS intake when work should begin from a lead or form.',
    bullets: [
      'Manual creation is best for your first live docket.',
      'CMS is best when intake should create work from leads.',
    ],
  },
];

const makeStorageKey = (firmSlug, userXid) => `${STORAGE_PREFIX}:${firmSlug || 'firm'}:${userXid || 'user'}`;

export const OnboardingModal = ({ showTutorial, onComplete }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const firmSlug = user?.firmSlug;
  const userXid = user?.xID || user?.xid || user?.id;

  const storageKey = useMemo(() => makeStorageKey(firmSlug, userXid), [firmSlug, userXid]);

  useEffect(() => {
    let cancelled = false;

    const restoreSavedState = () => {
      if (typeof window === 'undefined') return { currentStep: 0, dismissed: false };
      try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
        return {
          currentStep: Number.isInteger(parsed?.currentStep) ? parsed.currentStep : 0,
          dismissed: Boolean(parsed?.dismissed),
        };
      } catch (_error) {
        return { currentStep: 0, dismissed: false };
      }
    };

    const load = async () => {
      if (!user) {
        if (!cancelled) {
          setOpen(false);
          setLoading(false);
        }
        return;
      }

      const saved = restoreSavedState();
      const tutorialRequired = Boolean(showTutorial);

      try {
        const [summaryResponse, setupResponse] = await Promise.allSettled([
          dashboardApi.getSummary({ filter: 'ALL', limit: 1 }),
          dashboardApi.getSetupStatus(),
        ]);

        if (cancelled) return;

        const totalDockets = Number(summaryResponse.status === 'fulfilled'
          ? summaryResponse.value?.data?.totalDockets
          : 0);
        const isSetupComplete = Boolean(setupResponse.status === 'fulfilled'
          ? setupResponse.value?.data?.isSetupComplete
          : false);

        const shouldOpen = tutorialRequired || totalDockets === 0 || !isSetupComplete;
        setStepIndex(Math.min(saved.currentStep, STEPS.length - 1));
        setOpen(shouldOpen && !saved.dismissed);
      } catch (_error) {
        if (!cancelled) {
          setStepIndex(Math.min(saved.currentStep, STEPS.length - 1));
          setOpen(tutorialRequired && !saved.dismissed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [showTutorial, storageKey, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify({ currentStep: stepIndex, dismissed: false }));
  }, [stepIndex, storageKey]);

  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const persistDismissed = (dismissed) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify({ currentStep: stepIndex, dismissed }));
  };

  const handleClose = async ({ complete = false, dismissed = true } = {}) => {
    persistDismissed(dismissed);
    setOpen(false);
    if (complete || showTutorial) {
      await onComplete?.();
    }
  };

  const openRoute = (route) => {
    persistDismissed(false);
    setOpen(false);
    navigate(route);
  };

  const renderStepActions = () => {
    if (currentStep.key === 'mapping') {
      return (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => openRoute(ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug))}>
            Open category setup
          </Button>
          <Button variant="secondary" onClick={() => openRoute(ROUTES.SETTINGS(firmSlug))}>
            Review workbasket mapping
          </Button>
        </div>
      );
    }

    if (currentStep.key === 'team') {
      return (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => openRoute(ROUTES.ADMIN(firmSlug))}>
            Invite team
          </Button>
        </div>
      );
    }

    if (currentStep.key === 'first-docket') {
      return (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => openRoute(ROUTES.CREATE_CASE(firmSlug))}>
            Create docket manually
          </Button>
          <Button variant="secondary" onClick={() => openRoute(ROUTES.CMS(firmSlug))}>
            Use CMS intake
          </Button>
        </div>
      );
    }

    return null;
  };

  if (loading || !user || !open) {
    return null;
  }

  return (
    <Modal
      isOpen={open}
      onClose={() => { void handleClose(); }}
      title="Welcome to your Docketra workspace"
      actions={(
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => { void handleClose(); }}>
            Skip for now
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}>
              Back
            </Button>
            {isLastStep ? (
              <Button variant="primary" onClick={() => { void handleClose({ complete: true, dismissed: true }); }}>
                Finish onboarding
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setStepIndex((value) => Math.min(STEPS.length - 1, value + 1))}>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" aria-label="Onboarding progress">
          {STEPS.map((step, index) => (
            <button
              key={step.key}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${index === stepIndex ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}
              onClick={() => setStepIndex(index)}
            >
              {index + 1}. {step.title}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {stepIndex + 1} of {STEPS.length}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{currentStep.title}</h3>
          <p className="mt-2 text-sm text-slate-700">{currentStep.description}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {currentStep.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          {renderStepActions()}
        </div>
      </div>
    </Modal>
  );
};
