import { request } from './apiClient';

export const bulkUploadApi = {
  preview: (type, payload) => request(
    (http) => http.post(`/bulk-upload/${type}`, payload),
    'Failed to preview bulk upload',
  ),
  confirm: (type, rows, duplicateMode = 'skip', isAsync = true) => request(
    (http) => http.post(`/bulk-upload/${type}/confirm`, { rows, duplicateMode, async: isAsync }),
    'Failed to import bulk data',
  ),
  jobStatus: (jobId) => request(
    (http) => http.get(`/bulk-upload/job/${jobId}`),
    'Failed to fetch bulk upload job status',
  ),
};
