import React, { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { productUpdatesService } from '../../services/productUpdatesService';

export const FirstLoginExperience = () => {
  const { user, isAuthResolved, isAuthenticated, updateUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const showTutorial = Boolean(user?.welcomeTutorial?.show);
  const showWhatsNew = !showTutorial && Boolean(user?.whatsNew?.show && user?.whatsNew?.update?._id);

  const tutorialSteps = useMemo(
    () => (Array.isArray(user?.welcomeTutorial?.steps) ? user.welcomeTutorial.steps : []),
    [user?.welcomeTutorial?.steps],
  );

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
        title={`Welcome to Docketra${user?.welcomeTutorial?.role === 'admin' ? ' — Admin setup' : ''}`}
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
