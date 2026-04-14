import { request } from './apiClient';

export const docketBulkUploadApi = {
  preview: (payload) => request(
    (http) => http.post('/dockets/bulk/preview', payload),
    'Failed to preview docket bulk upload',
  ),
  upload: (payload) => request(
    (http) => http.post('/dockets/bulk/upload', payload),
    'Failed to upload dockets',
  ),
};
