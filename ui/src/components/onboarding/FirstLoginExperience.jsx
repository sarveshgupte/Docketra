import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { productUpdatesService } from '../../services/productUpdatesService';
import { getRoleOnboardingContent, normalizeOnboardingRole } from './roleOnboardingContent';
import { resolveTutorialPersistenceIntent } from './firstLoginFlowPersistence';
import { trackOnboardingEvent } from '../../utils/onboardingAnalytics';
import { DocketraProductTour } from './DocketraProductTour';
import { SetupFirstClientModal } from './SetupFirstClientModal';

export const FirstLoginExperience = () => {
  const { user, isAuthResolved, isAuthenticated, updateUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [showFirstClientModal, setShowFirstClientModal] = useState(false);

  const serverShowTutorial = Boolean(user?.welcomeTutorial?.show);
  const isTourQuery = typeof window !== 'undefined' && window.location.search.includes('tour=start');
  const showTutorial = Boolean(serverShowTutorial || manualOpen || isTourQuery);
  const isFirstLoginTutorial = Boolean(serverShowTutorial);
  const showWhatsNew = !showTutorial && Boolean(user?.whatsNew?.show && user?.whatsNew?.update?._id);
  const roleKey = normalizeOnboardingRole(user?.welcomeTutorial?.role || user?.role);

  useEffect(() => {
    if (!showTutorial) return;
    trackOnboardingEvent({
      eventName: 'welcome_tutorial_shown',
      metadata: { mode: isFirstLoginTutorial ? 'first_login' : 'manual_replay' },
    });
  }, [isFirstLoginTutorial, showTutorial]);

  useEffect(() => {
    const handleReplay = () => {
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
      stepIndex: 4,
    });

    if (isTourQuery && typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('tour');
      window.history.replaceState({}, '', url.toString());
    }

    if (!persistencePayload) {
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
    } catch (_err) {
      // Non-blocking
    } finally {
      setSubmitting(false);
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

  const firmSlug = user?.firmSlug || user?.firm?.firmSlug || '';

  return (
    <>
      {/* Step 5: Interactive Step-by-Step Product Tour */}
      <DocketraProductTour
        isOpen={showTutorial}
        onClose={() => completeTutorial('skipped')}
        onCompleteTour={() => completeTutorial('completed')}
        onAddFirstClient={() => {
          completeTutorial('completed');
          setShowFirstClientModal(true);
        }}
      />

      {/* Step 6: Add First Corporate Client Modal */}
      <SetupFirstClientModal
        isOpen={showFirstClientModal}
        onClose={() => setShowFirstClientModal(false)}
        firmSlug={firmSlug}
      />

      {/* What's New Release Updates Modal */}
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

export default FirstLoginExperience;
