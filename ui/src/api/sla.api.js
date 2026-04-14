import { request } from './apiClient';

export const slaApi = {
  getRules: (params = {}) => request((http) => http.get('/sla/rules', { params }), 'Failed to load SLA rules'),
  saveRule: (payload) => request((http) => http.post('/sla/rules', payload), 'Failed to save SLA rule'),
  deleteRule: (ruleId) => request((http) => http.delete(`/sla/rules/${ruleId}`), 'Failed to delete SLA rule'),
};
