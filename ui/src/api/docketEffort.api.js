import { request } from './apiClient';
import { buildQueryString } from '../utils/queryParams';

export const docketEffortApi = {
  getDocketEfforts: (filters = {}) =>
    request((http) => http.get(`/docket-efforts${buildQueryString(filters)}`), 'Failed to load effort logs'),

  createDocketEffort: (payload) =>
    request((http) => http.post('/docket-efforts', payload), 'Failed to log effort'),

  deleteDocketEffort: (id) =>
    request((http) => http.delete(`/docket-efforts/${id}`), 'Failed to delete effort log'),

  updateDocketBudget: (caseId, payload) =>
    request((http) => http.patch(`/docket-efforts/docket/${caseId}/budget`, payload), 'Failed to update docket budget'),

  getProfitabilityReports: () =>
    request((http) => http.get('/docket-efforts/reports/profitability'), 'Failed to load profitability reports'),
};
