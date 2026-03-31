import { request } from './apiClient';

export const metricsApi = {
  getFirmMetrics: (firmId) => request((http) => http.get(`/firm/${firmId}/metrics`), 'Failed to load firm metrics'),
};
