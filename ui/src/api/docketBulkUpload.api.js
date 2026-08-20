import { request } from './apiClient';

export const docketBulkUploadApi = {
  downloadTemplate: () => request(
    (http) => http.get('/dockets/bulk/template', { responseType: 'blob' }),
    'Failed to download docket import template',
  ),
  preview: (payload) => request(
    (http) => http.post('/dockets/bulk/preview', payload),
    'Failed to preview docket bulk upload',
  ),
  upload: (payload) => request(
    (http) => http.post('/dockets/bulk/upload', payload),
    'Failed to upload dockets',
  ),
};
