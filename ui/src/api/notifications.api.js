import { request } from './apiClient';

export const notificationsApi = {
  getNotifications: ({ limit } = {}) => request((http) => http.get('/notifications', { params: { limit } }), 'Failed to load notifications'),
  getAllNotifications: () => request((http) => http.get('/notifications/all'), 'Failed to load notifications'),
  markAsRead: (id) => request((http) => http.post(`/notifications/${id}/read`), 'Failed to mark notification as read'),
  getPreferences: () => request((http) => http.get('/notifications/preferences'), 'Failed to load notification preferences'),
  updatePreferences: (payload) => request((http) => http.patch('/notifications/preferences', payload), 'Failed to update notification preferences'),
};
