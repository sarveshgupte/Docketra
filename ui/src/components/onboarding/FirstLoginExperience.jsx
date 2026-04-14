import React, { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { productUpdatesService } from '../../services/productUpdatesService';

const FEATURE_HIGHLIGHTS = [
  'Dashboard KPI cards for overdue, upcoming, and approval-risk visibility.',
  'Workbasket and Worklist flow for firm-level triage and execution ownership.',
  'Docket lifecycle tracking with status, priority, assignee, and due date controls.',
  'Centralized notifications and audit-friendly activity visibility.',
];

const ROLE_SETUP_GUIDANCE = {
  primary_admin: {
    label: 'Primary Admin firm setup (after tutorial)',
    steps: [
      'Complete Firm Settings (firm profile + compliance defaults).',
      'Configure Storage Settings so document uploads are production-ready.',
      'Define categories and work types in Work Settings.',
      'Invite admins and team members, then validate hierarchy setup.',
      'Create and assign the first docket to verify the end-to-end workflow.',
    ],
  },
  admin: {
    label: 'Admin setup sequence (after tutorial)',
    steps: [
      'Review assigned hierarchy and operating permissions in Admin.',
      'Invite/activate your execution users and align ownership model.',
      'Create the first working dockets and assign owners.',
      'Use Workbasket for intake triage and move actionable items to Worklist.',
      'Review dashboard KPIs daily for overdue and approval-risk items.',
    ],
  },
  user: {
    label: 'User first-week workflow (after tutorial)',
    steps: [
      'Start each day from My Worklist and prioritize overdue items.',
      'Update docket status and add comments for transparent progress.',
      'Raise unassigned or blocked dockets with your reporting admin.',
      'Use filters/search to quickly locate due-soon and high-priority dockets.',
      'Keep profile/contact details current for alerts and audit trails.',
    ],
  },
};

export const FirstLoginExperience = () => {
  const { user, isAuthResolved, isAuthenticated, updateUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const showTutorial = Boolean(user?.welcomeTutorial?.show);
  const showWhatsNew = !showTutorial && Boolean(user?.whatsNew?.show && user?.whatsNew?.update?._id);

  const tutorialSteps = useMemo(
    () => (Array.isArray(user?.welcomeTutorial?.steps) ? user.welcomeTutorial.steps : []),
    [user?.welcomeTutorial?.steps],
  );
  const tutorialRole = String(user?.welcomeTutorial?.role || 'user').trim().toLowerCase();
  const setupGuidance = ROLE_SETUP_GUIDANCE[tutorialRole] || ROLE_SETUP_GUIDANCE.user;
  const tutorialTitleSuffix = tutorialRole === 'primary_admin'
    ? ' — Primary Admin setup'
    : (tutorialRole === 'admin' ? ' — Admin setup' : '');

  if (!isAuthResolved || !isAuthenticated || !user) {
    return null;
  }

  const handleCompleteTutorial = async () => {
    try {
      setSubmitting(true);
      await productUpdatesService.completeTutorial();
      updateUser({
        welcomeTutorial: {
          ...(user?.welcomeTutorial || {}),
          show: false,
        },
      });
    } finally {
      setSubmitting(false);
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

  return (
    <>
      <Modal
        isOpen={showTutorial}
        onClose={handleCompleteTutorial}
        title={`Welcome to Docketra${tutorialTitleSuffix}`}
        actions={(
          <Button variant="primary" onClick={handleCompleteTutorial} disabled={submitting}>
            Start using Docketra
          </Button>
        )}
      >
        <p className="mb-4 text-sm text-gray-600">Here is a quick tutorial to help you get value from your first session.</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          {tutorialSteps.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Key product features</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {FEATURE_HIGHLIGHTS.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{setupGuidance.label}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-blue-900">
            {setupGuidance.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
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
