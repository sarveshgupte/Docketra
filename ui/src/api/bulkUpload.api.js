import { request } from './apiClient';

export const bulkUploadApi = {
  preview: (type, csvContent) => request(
    (http) => http.post(`/bulk-upload/${type}`, { csvContent }),
    'Failed to preview CSV upload',
  ),
  confirm: (type, rows) => request(
    (http) => http.post(`/bulk-upload/${type}/confirm`, { rows }),
    'Failed to import CSV data',
  ),
};
