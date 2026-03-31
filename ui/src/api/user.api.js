import { request } from './apiClient';

export const userApi = {
  getCurrentUser: () =>
    request((http) => http.get('/user/me'), 'Unable to load your profile details.'),

  completeProfile: ({ name, firmName, phone, phoneNumber }) =>
    request(
      (http) => http.post('/user/complete-profile', { name, firmName, ...(phone ? { phone } : {}), ...(phoneNumber ? { phoneNumber } : {}) }),
      'Failed to complete profile'
    ),
};
