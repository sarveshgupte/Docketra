import { request } from './apiClient';
import { buildQueryString } from '../utils/queryParams';

export const adminApi = {
  getAdminStats: () => request((http) => http.get('/admin/stats'), 'Failed to load admin stats'),
  createUser: (userData) => request((http) => http.post('/admin/users', userData), 'Failed to create user'),
  getUsers: (params = {}) => request((http) => http.get(`/admin/users${buildQueryString(params)}`), 'Failed to load users'),
  getHierarchy: () => request((http) => http.get('/admin/hierarchy'), 'Failed to load hierarchy tree'),

  activateUser: (xID) => request((http) => http.put(`/admin/users/${xID}/activate`), 'Failed to activate user'),
  deactivateUser: (xID) => request((http) => http.put(`/admin/users/${xID}/deactivate`), 'Failed to deactivate user'),
  updateUserStatus: (xID, active) => (active ? adminApi.activateUser(xID) : adminApi.deactivateUser(xID)),

  resetPassword: (xID) => request((http) => http.post('/auth/reset-password', { xID }), 'Failed to reset password'),
  resendSetupEmail: (xID) => request((http) => http.post(`/admin/users/${xID}/resend-invite`), 'Failed to resend setup email'),
  updateRestrictedClients: (xID, restrictedClientIds = []) => request(
    (http) => http.patch(`/admin/users/${xID}/restrict-clients`, { restrictedClientIds }),
    'Failed to update user client access'
  ),
  updateUserWorkbaskets: (xID, teamIds = []) => request(
    (http) => http.patch(`/admin/users/${xID}/workbaskets`, { teamIds }),
    'Failed to update user workbasket access'
  ),
  updateUserHierarchy: (id, payload) => request((http) => http.patch(`/admin/users/${id}/hierarchy`, payload), 'Failed to update hierarchy'),
  getFirmSettings: () => request((http) => http.get('/admin/firm-settings'), 'Failed to load firm settings'),
  getFirmSettingsActivity: (params = {}) => request((http) => http.get('/admin/firm-settings/activity', { params }), 'Failed to load admin settings activity'),
  updateFirmSettings: (payload) => request((http) => http.put('/admin/firm-settings', payload), 'Failed to save firm settings'),
  listWorkbaskets: (params = {}) => request((http) => http.get('/admin/workbaskets', { params }), 'Failed to load workbaskets'),
  createWorkbasket: (name) => request((http) => http.post('/admin/workbaskets', { name }), 'Failed to create workbasket'),
  renameWorkbasket: (workbasketId, name) => request((http) => http.put(`/admin/workbaskets/${workbasketId}`, { name }), 'Failed to rename workbasket'),
  toggleWorkbasketStatus: (workbasketId, isActive) => request((http) => http.patch(`/admin/workbaskets/${workbasketId}/status`, { isActive }), 'Failed to update workbasket status'),
  unlockAccount: (xID) => request((http) => http.post('/auth/unlock-account', { xID }), 'Failed to unlock account'),

  getPendingApprovals: () => request((http) => http.get('/cases?status=UNDER_REVIEW,Reviewed,Pending'), 'Failed to load pending approvals'),
  approveNewClient: (caseId, comment = '') => request((http) => http.post(`/client-approval/${caseId}/approve-new`, { comment }), 'Failed to approve new client case'),
  approveClientEdit: (caseId, comment = '') => request((http) => http.post(`/client-approval/${caseId}/approve-edit`, { comment }), 'Failed to approve client edit case'),
  rejectCase: (caseId, comment) => request((http) => http.post(`/client-approval/${caseId}/reject`, { comment }), 'Failed to reject case'),

  listClients: (params = { activeOnly: false }) => request((http) => http.get('/admin/clients', { params }), 'Failed to list clients'),
  getClientById: (clientId) => request((http) => http.get(`/client-approval/clients/${clientId}`), 'Failed to load client'),
  getAllResolvedCases: (params = {}) => request((http) => http.get(`/admin/cases/resolved${buildQueryString(params)}`), 'Failed to load resolved cases'),

  getStorageConfig: () => request((http) => http.get('/admin/storage'), 'Failed to load storage config'),
  updateStorageConfig: (payload) => request((http) => http.put('/admin/storage', payload), 'Failed to update storage config'),
  disconnectStorage: () => request((http) => http.post('/admin/storage/disconnect'), 'Failed to disconnect storage'),
};
