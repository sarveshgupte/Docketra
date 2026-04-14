import { request } from './apiClient';

export const dashboardApi = {
  getSummary: async ({ filter = 'MY', page = 1, limit = 10 } = {}) =>
    request((api) => api.get('/dashboard/summary', { params: { filter, page, limit } }), 'Failed to load dashboard summary'),
  getSetupStatus: async () =>
    request((api) => api.get('/firm/setup-status'), 'Failed to load firm setup status'),
};
