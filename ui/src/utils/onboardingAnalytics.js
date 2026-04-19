import { dashboardApi } from '../api/dashboard.api';

const ALLOWED_EVENTS = new Set([
  'welcome_tutorial_shown',
  'welcome_tutorial_completed',
  'welcome_tutorial_skipped',
  'product_tour_started',
  'product_tour_completed',
  'onboarding_step_completed_manual',
  'onboarding_step_cta_opened',
  'onboarding_checklist_dismissed',
]);

export const trackOnboardingEvent = async ({ eventName, stepId, source, metadata } = {}) => {
  if (!ALLOWED_EVENTS.has(eventName)) return;

  try {
    await dashboardApi.trackOnboardingEvent({
      eventName,
      stepId: stepId || undefined,
      source: source || undefined,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    });
  } catch (error) {
    console.warn('[OnboardingAnalytics] Failed to track event', {
      eventName,
      message: error?.message,
    });
  }
};
