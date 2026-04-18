import { request } from './apiClient';

export const formsApi = {
  listForms: () => request((http) => http.get('/forms'), 'Failed to load forms'),
  updateForm: (id, data) => request((http) => http.patch(`/forms/${id}`, data), 'Failed to update form'),
};

export const publicFormsApi = {
  getForm: (id, params) => request((http) => http.get(`/public/forms/${id}`, { params }), 'Failed to load public form'),
  submitForm: (id, data, params) => request((http) => http.post(`/public/forms/${id}/submit`, data, { params }), 'Failed to submit form'),
};
