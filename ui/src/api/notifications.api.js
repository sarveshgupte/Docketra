import { request } from './apiClient';

export const notificationsApi = {
  getNotifications: () => request((http) => http.get('/notifications'), 'Failed to load notifications'),
};
