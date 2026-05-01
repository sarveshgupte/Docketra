import { request } from './apiClient';

export const knowledgeItemsApi = {
  listKnowledgeItems: (params) => request((http) => http.get('/knowledge-items', { params }), 'Failed to load knowledge items'),
  createKnowledgeItem: (data) => request((http) => http.post('/knowledge-items', data), 'Failed to create knowledge item'),
  getKnowledgeItem: (id) => request((http) => http.get(`/knowledge-items/${id}`), 'Failed to load knowledge item'),
  updateKnowledgeItem: (id, data) => request((http) => http.patch(`/knowledge-items/${id}`, data), 'Failed to update knowledge item'),
  archiveKnowledgeItem: (id) => request((http) => http.post(`/knowledge-items/${id}/archive`), 'Failed to archive knowledge item'),
};
