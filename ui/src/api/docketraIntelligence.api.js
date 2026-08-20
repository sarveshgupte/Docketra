import { request } from './apiClient';

export const docketraIntelligenceApi = {
  getWorkload: async (params = {}) =>
    request((api) => api.get('/docketra-intelligence/workload', { params }), 'Failed to load workload intelligence'),
  getWorkbasketCapacity: async (params = {}) =>
    request((api) => api.get('/docketra-intelligence/workbasket-capacity', { params }), 'Failed to load workbasket capacity intelligence'),
  getDeadlineRisk: async () =>
    request((api) => api.get('/docketra-intelligence/deadline-risk'), 'Failed to load deadline risk intelligence'),
  getExecutiveBrief: async () =>
    request((api) => api.get('/docketra-intelligence/executive-brief'), 'Failed to load executive brief'),
  getClientRisk: async () =>
    request((api) => api.get('/docketra-intelligence/client-risk'), 'Failed to load client risk scores'),
  rebalanceWorkload: async (execute = false) =>
    request((api) => api.post('/docketra-intelligence/rebalance', { execute }), 'Failed to rebalance workload'),
};
