import { request } from './apiClient';

export const dashboardApi = {
  getSummary: async ({ filter = 'MY', page = 1, limit = 10, sort = 'NEWEST', workbasketId, only } = {}) =>
    request((api) => api.get('/dashboard/summary', { params: { filter, page, limit, sort, workbasketId, only } }), 'Failed to load dashboard summary'),
  getSetupStatus: async () =>
    request((api) => api.get('/firm/setup-status'), 'Failed to load firm setup status'),
  getOnboardingProgress: async () =>
    request((api) => api.get('/dashboard/onboarding-progress'), 'Failed to load onboarding progress'),
  trackOnboardingEvent: async (payload) =>
    request((api) => api.post('/dashboard/onboarding-event', payload), 'Failed to record onboarding event'),
};
