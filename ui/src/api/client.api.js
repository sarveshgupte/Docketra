import { request } from './apiClient';

export const clientApi = {
  getClients: (activeOnly = false, forCreateCase = false, options = {}) => {
    const params = forCreateCase
      ? { forCreateCase: 'true' }
      : { activeOnly: activeOnly ? 'true' : 'false' };
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;
    if (options.search) params.search = options.search;
    return request((http) => http.get('/clients', { params }), 'Failed to load clients');
  },

  getClientById: (clientId) => request((http) => http.get(`/clients/${clientId}`), 'Failed to load client details'),
  createClient: (clientData) => request((http) => http.post('/admin/clients', clientData), 'Failed to create client'),
  updateClient: (clientId, clientData) => request((http) => http.put(`/admin/clients/${clientId}`, clientData), 'Failed to update client'),
  toggleClientStatus: (clientId, isActive) => request((http) => http.patch(`/admin/clients/${clientId}/status`, { isActive }), 'Failed to update client status'),
  changeLegalName: (clientId, newBusinessName, reason) => request((http) => http.post(`/admin/clients/${clientId}/change-name`, { newBusinessName, reason }), 'Failed to change legal name'),

  updateClientFactSheet: (clientId, description, notes, basicInfo) => request(
    (http) => http.put(`/clients/${clientId}/fact-sheet`, { description, notes, basicInfo }),
    'Failed to update fact sheet',
  ),

  getClientDockets: (clientId) => request((http) => http.get(`/clients/${clientId}/dockets`), 'Failed to load client dockets'),
  getClientActivity: (clientId) => request((http) => http.get(`/clients/${clientId}/activity`), 'Failed to load client activity'),
  getClientCfsComments: (clientId) => request((http) => http.get(`/clients/${clientId}/cfs/comments`), 'Failed to load fact sheet comments'),
  addClientCfsComment: (clientId, payload) => request((http) => http.post(`/clients/${clientId}/cfs/comments`, payload), 'Failed to add comment'),

  uploadClientCFSFile: async (clientId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', 'Client Fact Sheet attachment');
    formData.append('fileType', 'documents');

    return request(
      (http) => http.post(`/clients/${clientId}/cfs/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
      'Failed to upload file',
    );
  },

  uploadFactSheetFile: (clientId, file) => clientApi.uploadClientCFSFile(clientId, file),
  deleteFactSheetFile: (clientId, fileId) => request((http) => http.delete(`/clients/${clientId}/cfs/files/${fileId}`), 'Failed to delete file'),
  getClientFactSheetForCase: (caseId) => request((http) => http.get(`/cases/${caseId}/client-fact-sheet`), 'Failed to load client fact sheet'),
  getClientFactSheetFileViewUrl: (caseId, fileId) => `/cases/${caseId}/client-fact-sheet/files/${fileId}/view`,
};
