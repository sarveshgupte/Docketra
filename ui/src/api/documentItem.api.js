import { request } from './apiClient';
import { buildQueryString } from '../utils/queryParams';

export const documentItemApi = {
  getDocumentItems: (filters = {}) =>
    request((http) => http.get(`/document-items${buildQueryString(filters)}`), 'Failed to load documents'),
  
  createDocumentItem: (payload) =>
    request((http) => http.post('/document-items', payload), 'Failed to create document pack'),

  addDocumentVersion: (id, fileReference, changeNote) =>
    request((http) => http.post(`/document-items/${id}/versions`, { fileReference, changeNote }), 'Failed to upload document version'),

  updateDocumentStatus: (id, status) =>
    request((http) => http.patch(`/document-items/${id}/status`, { status }), 'Failed to update document status'),

  selectCurrentVersion: (id, versionNumber) =>
    request((http) => http.patch(`/document-items/${id}/version-select`, { versionNumber }), 'Failed to select active document version'),
};
