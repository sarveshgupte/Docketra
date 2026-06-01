import { request } from './apiClient';

export const dashboardApi = {
  getSummary: async ({ filter = 'MY', page = 1, limit = 10, sort = 'NEWEST', workbasketId, only } = {}) =>
    request((api) => api.get('/dashboard/summary', { params: { filter, page, limit, sort, workbasketId, only } }), 'Failed to load dashboard summary'),
  getRiskBrief: async () =>
    request((api) => api.get('/dashboard/risk-brief'), 'Failed to load morning risk brief'),
  getPartnerMorningDashboard: async (filters = {}) =>
    request((api) => api.get('/dashboard/partner-morning', { params: filters }), 'Failed to load partner morning dashboard'),
  getComplianceControlRoom: async (filters = {}) =>
    request((api) => api.get('/dashboard/compliance-control-room', { params: filters }), 'Failed to load compliance control room'),
  updateComplianceState: async (caseId, payload) =>
    request((api) => api.patch(`/dashboard/compliance-control-room/${caseId}/state`, payload), 'Failed to update compliance state'),
  listComplianceTemplates: async (params = {}) =>
    request((api) => api.get('/dashboard/compliance-templates', { params }), 'Failed to load compliance templates'),
  createComplianceTemplate: async (payload) =>
    request((api) => api.post('/dashboard/compliance-templates', payload), 'Failed to create compliance template'),
  updateComplianceTemplate: async (templateId, payload) =>
    request((api) => api.put(`/dashboard/compliance-templates/${templateId}`, payload), 'Failed to update compliance template'),
  seedSampleComplianceTemplates: async () =>
    request((api) => api.post('/dashboard/compliance-templates/seed-samples', {}), 'Failed to seed sample compliance templates'),
  previewComplianceGeneration: async (payload) =>
    request((api) => api.post('/dashboard/compliance-generation/preview', payload), 'Failed to preview compliance generation'),
  runComplianceGeneration: async (payload) =>
    request((api) => api.post('/dashboard/compliance-generation/run', payload), 'Failed to run compliance generation'),
  getApprovalQueues: async (filters = {}) =>
    request((api) => api.get('/dashboard/approval-queues', { params: filters }), 'Failed to load approval queues'),
  remindApproval: async (caseId, payload = {}) =>
    request((api) => api.post(`/dashboard/approval-queues/${caseId}/remind`, payload), 'Failed to queue approval reminder'),
  getSetupStatus: async () =>
    request((api) => api.get('/firm/setup-status'), 'Failed to load firm setup status'),
  getOnboardingProgress: async () =>
    request((api) => api.get('/dashboard/onboarding-progress'), 'Failed to load onboarding progress'),
  trackOnboardingEvent: async (payload) =>
    request((api) => api.post('/dashboard/onboarding-event', payload), 'Failed to record onboarding event'),
};
