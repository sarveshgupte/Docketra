import { request } from './apiClient';

export const notificationsApi = {
  getNotifications: ({ limit } = {}) => request((http) => http.get('/notifications', { params: { limit } }), 'Failed to load notifications'),
  getAllNotifications: () => request((http) => http.get('/notifications/all'), 'Failed to load notifications'),
  markAsRead: (id) => request((http) => http.patch(`/notifications/${id}/read`), 'Failed to mark notification as read'),
};
