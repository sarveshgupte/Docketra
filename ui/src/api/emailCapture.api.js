import { request } from './apiClient';
import { buildQueryString } from '../utils/queryParams';

export const emailCaptureApi = {
  getEmailCaptures: (filters = {}) =>
    request((http) => http.get(`/email-captures${buildQueryString(filters)}`), 'Failed to load email captures'),

  createEmailCapture: (payload) =>
    request((http) => http.post('/email-captures', payload), 'Failed to ingest email capture'),
};
