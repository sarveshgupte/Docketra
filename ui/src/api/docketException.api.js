import { request } from './apiClient';
import { buildQueryString } from '../utils/queryParams';

export const docketExceptionApi = {
  getDocketExceptions: (filters = {}) =>
    request((http) => http.get(`/docket-exceptions${buildQueryString(filters)}`), 'Failed to load exceptions'),

  createDocketException: (payload) =>
    request((http) => http.post('/docket-exceptions', payload), 'Failed to log exception'),

  updateDocketException: (id, payload) =>
    request((http) => http.patch(`/docket-exceptions/${id}`, payload), 'Failed to update exception'),

  getExceptionDashboard: () =>
    request((http) => http.get('/docket-exceptions/dashboard'), 'Failed to load exception dashboard'),
};
