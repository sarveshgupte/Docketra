import { request } from './apiClient';

export const caseApi = {
  getMyPendingCases: () =>
    request((http) => http.get('/cases/my-pending'), 'Failed to load pending cases.'),

  getAdminFiledCases: () =>
    request((http) => http.get('/admin/cases/filed'), 'Failed to load filed cases.'),
};
